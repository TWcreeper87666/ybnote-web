import { Application, useApplication } from "@pixi/react";
import { useStore } from "../../store/useStore";
import { useGameStore } from "../../store/useGameStore";
import { useLevelEditorStore } from "../../store/useLevelEditorStore";
import { useCanvasContext } from "./CanvasContext";
import { PocketNoteBlock } from "../blocks/PocketNoteBlock";
import { usePocketCanvasCamera } from "../../hooks/usePocketCanvasCamera";
import { useCanvasInteractions } from "../../hooks/useCanvasInteractions";
import { lineIntersectsRect } from "../../utils/geometry";
import { SelectionBoxRenderer } from "./shared/SelectionBoxRenderer";
import { TrailRenderer } from "./shared/TrailRenderer";
import { playNote } from "../../utils/audio";
import { useEffect, useMemo } from "react";
import * as PIXI from "pixi.js";
import { getDrumPitchByMidiNote } from "../../config/instruments";

const ResizeHandler = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  const { app, isInitialised } = useApplication();
  useEffect(() => {
    if (isInitialised && app && app.renderer) {
      app.renderer.resize(width, height);
    }
  }, [width, height, app, isInitialised]);
  return null;
};

interface PocketCanvasProps {
  containerWidth: number;
  containerHeight: number;
  showOnlyMissing?: boolean;
}

export const PocketCanvas: React.FC<PocketCanvasProps> = ({
  containerWidth,
  containerHeight,
  showOnlyMissing,
}) => {
  const canvasContext = useCanvasContext();
  const pocketBlocks = useStore((state) => state.pocketBlocks);
  const blocks = useStore((state) => state.blocks);
  const editorBlocks = useLevelEditorStore((state) => state.blocks);
  const gamePhase = useGameStore((state) => state.gamePhase);
  const midiData = useLevelEditorStore((state) => state.midiData);
  const pocketSortMode = useStore((state) => state.pocketSortMode);
  const pocketCamera = useStore((state) => state.pocketCamera);
  const clearPocketSelection = useStore((state) => state.clearPocketSelection);
  const setArrangedPocketBlocks = useStore(
    (state) => state.setArrangedPocketBlocks,
  );

  usePocketCanvasCamera();

  const {
    startPan,
    updatePan,
    endPan,
    selectionBox,
    startSelection,
    updateSelection,
    endSelection,
    activeStrokesRef,
    currentStrokeId,
    startTrail,
    updateTrail,
    endTrail,
    intersectedBlocksRef,
    isSelectingRef,
  } = useCanvasInteractions();

  // Layout parameters
  const BLOCK_SIZE = 60;
  const SPACING = 20;
  const PADDING = 20;

  const layoutWidth = Math.max(200, containerWidth);

  // Build set of pitch+instrument combos that belong to at least one non-background track
  const nonBackgroundCombos = useMemo(() => {
    if (!midiData) return null;
    const set = new Set<string>();

    for (const track of midiData.tracks) {
      if (!track.isBackground) {
        const inst = track.instrument || "piano";

        for (const note of track.notes) {
          // 👇 修正這裡：讓過濾器也把數字 36 翻譯成 'kick'
          const pitch =
            inst === "percussion"
              ? getDrumPitchByMidiNote(note.pitch as number)
              : note.name;

          set.add(`${pitch}-${inst}`);
        }
      }
    }
    return set;
  }, [midiData]);

  const filteredBlocks = useMemo(() => {
    let result = pocketBlocks;

    // Hide pocket blocks whose pitch+instrument only appear in background tracks
    if (nonBackgroundCombos) {
      result = result.filter((b) =>
        nonBackgroundCombos.has(`${b.pitch}-${b.instrument || "piano"}`),
      );
    }

    if (!showOnlyMissing) return result;
    const allMainBlocks =
      gamePhase === "arrange"
        ? useGameStore.getState().blocks
        : canvasContext === "editor"
          ? editorBlocks
          : blocks;
    return result.filter((pocketBlock) => {
      return !allMainBlocks.some(
        (b) =>
          b.pitch === pocketBlock.pitch &&
          (b.instrument || "piano") === pocketBlock.instrument,
      );
    });
  }, [
    pocketBlocks,
    blocks,
    editorBlocks,
    gamePhase,
    canvasContext,
    showOnlyMissing,
    nonBackgroundCombos,
  ]);

  const gridBounds = useMemo(() => {
    const availableWidthForBlocks = layoutWidth - PADDING * 2 + SPACING;
    const cols = Math.max(
      1,
      Math.floor(availableWidthForBlocks / (BLOCK_SIZE + SPACING)),
    );
    const maxR = Math.max(
      0,
      filteredBlocks.length > 0
        ? Math.floor((filteredBlocks.length - 1) / cols)
        : 0,
    );
    return {
      maxX: PADDING + cols * (BLOCK_SIZE + SPACING),
      maxY: PADDING + (maxR + 1) * (BLOCK_SIZE + SPACING),
    };
  }, [filteredBlocks.length, layoutWidth]);

  const arrangedBlocks = useMemo(() => {
    type SortableBlock = (typeof pocketBlocks)[0] & {
      midiNumber?: number;
      originalTime?: number;
    };

    const sorted = [...filteredBlocks] as SortableBlock[];

    if (pocketSortMode === "pitch") {
      sorted.sort((a, b) => (a.midiNumber || 0) - (b.midiNumber || 0));
    } else {
      sorted.sort((a, b) => (a.originalTime || 0) - (b.originalTime || 0));
    }

    const availableWidthForBlocks = layoutWidth - PADDING * 2 + SPACING;
    const cols = Math.max(
      1,
      Math.floor(availableWidthForBlocks / (BLOCK_SIZE + SPACING)),
    );

    return sorted.map((block, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        ...block,
        xOffset: PADDING + col * (BLOCK_SIZE + SPACING),
        yOffset: PADDING + row * (BLOCK_SIZE + SPACING),
      };
    });
  }, [filteredBlocks, pocketSortMode, layoutWidth]);

  useEffect(() => {
    setArrangedPocketBlocks(arrangedBlocks);
  }, [arrangedBlocks, setArrangedPocketBlocks]);

  const checkTrailIntersection = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const currentFrameIntersected = new Set<string>();
    arrangedBlocks.forEach((b) => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.xOffset, b.yOffset, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
          useStore.getState().updatePocketBlock(b.id, { playedAt: Date.now() });
          playNote(b.pitch, b.volume || 1, b.instrument || "piano");
        }
      }
    });
    intersectedBlocksRef.current = currentFrameIntersected;
  };

  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    useStore.getState().setInteractionContext("pocket");
    const button =
      (e as unknown as { data?: { button?: number } }).data?.button ??
      (e.nativeEvent as PointerEvent)?.button ??
      e.button;
    if (button === 1) {
      // Middle click to pan
      startPan(e.global.x, e.global.y, pocketCamera.x, pocketCamera.y);
    } else if (button === 0) {
      if (e.target && e.target.label === "background") {
        clearPocketSelection();
        const pos = e.currentTarget.toLocal(e.global);
        startSelection(pos.x, pos.y);
      }
    } else if (button === 2) {
      // Right click to trail/play
      const pos = e.currentTarget.toLocal(e.global);
      startTrail(pos.x, pos.y);
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(pos.x, pos.y, pos.x, pos.y);
    }
  };

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
    updatePan(e.global.x, e.global.y, useStore.getState().updatePocketCamera);

    if (isSelectingRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const box = updateSelection(pos.x, pos.y);
      if (box) {
        const { x, y, w, h } = box;
        const selectedIds = arrangedBlocks
          .filter(
            (b) =>
              b.xOffset < x + w &&
              b.xOffset + 60 > x &&
              b.yOffset < y + h &&
              b.yOffset + 60 > y,
          )
          .map((b) => b.id);
        useStore.setState({ selectedPocketBlockIds: selectedIds });
      }
    } else if (
      e.buttons === 2 ||
      (e as unknown as { data?: { buttons?: number } }).data?.buttons === 2 ||
      (e.nativeEvent as PointerEvent)?.buttons === 2
    ) {
      const pos = e.currentTarget.toLocal(e.global);
      updateTrail(pos.x, pos.y, (p1) => {
        checkTrailIntersection(p1.x, p1.y, pos.x, pos.y);
      });
    }
  };

  // Clamp camera position to prevent panning too far away from notes
  useEffect(() => {
    const scaledMaxX = gridBounds.maxX * pocketCamera.zoom;
    const scaledMaxY = gridBounds.maxY * pocketCamera.zoom;
    const maxX = Math.max(containerWidth, scaledMaxX);
    const maxY = Math.max(containerHeight, scaledMaxY);

    // Limits: camera shouldn't go far left (so blocks disappear right),
    // and shouldn't go far right (blocks disappear left).
    // The camera coordinates represent where the top-left of the container is in world space.
    const minCamX = Math.min(0, containerWidth - maxX - 100);
    const maxCamX = 100;
    const minCamY = Math.min(0, containerHeight - maxY - 100);
    const maxCamY = 100;

    let { x, y } = pocketCamera;
    let clamped = false;

    if (x > maxCamX) {
      x = maxCamX;
      clamped = true;
    }
    if (x < minCamX) {
      x = minCamX;
      clamped = true;
    }
    if (y > maxCamY) {
      y = maxCamY;
      clamped = true;
    }
    if (y < minCamY) {
      y = minCamY;
      clamped = true;
    }

    if (clamped) {
      useStore.getState().updatePocketCamera({ x, y });
    }
  }, [
    pocketCamera,
    containerWidth,
    containerHeight,
    gridBounds.maxX,
    gridBounds.maxY,
  ]);

  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Application
        backgroundAlpha={0}
        width={containerWidth}
        height={containerHeight}
        antialias={true}
      >
        <pixiContainer
          x={pocketCamera.x}
          y={pocketCamera.y}
          scale={pocketCamera.zoom}
          eventMode="static"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <ResizeHandler width={containerWidth} height={containerHeight} />
          <pixiGraphics
            label="background"
            eventMode="static"
            draw={(g) => {
              g.clear();
              g.rect(-10000, -10000, 20000, 20000);
              g.fill({ color: 0x000000, alpha: 0.001 });
            }}
          />

          {arrangedBlocks.map((block) => (
            <PocketNoteBlock
              key={block.id}
              id={block.id}
              x={block.xOffset}
              y={block.yOffset}
              pitch={block.pitch}
              instrument={block.instrument}
              volume={block.volume || 1}
              playedAt={block.playedAt}
            />
          ))}

          <SelectionBoxRenderer
            selectionBox={selectionBox}
            zoom={pocketCamera.zoom}
          />
          <TrailRenderer
            activeStrokesRef={activeStrokesRef}
            currentStrokeId={currentStrokeId}
          />
        </pixiContainer>
      </Application>
    </div>
  );
};
