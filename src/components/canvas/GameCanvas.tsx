import React, { useEffect, useRef, useCallback } from "react";
import { Application, useTick } from "@pixi/react";
import * as PIXI from "pixi.js";
import { useStore } from "../../store/useStore";
import { useGameStore } from "../../store/useGameStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { NoteBlock } from "../blocks/NoteBlock";
import { useIsMobile } from "../../hooks/useIsMobile";
import { TrailRenderer } from "./shared/TrailRenderer";
import { GridBackground } from "./shared/GridBackground";
import { SelectionBoxRenderer } from "./shared/SelectionBoxRenderer";
import { GroupRectRenderer } from "../containers/GroupRectRenderer";
import { useCanvasCamera } from "../../hooks/useCanvasCamera";
import { useCanvasInteractions } from "../../hooks/useCanvasInteractions";
import {
  trySetPointerCapture,
  tryReleasePointerCapture,
} from "../../utils/canvasUtils";
import { CanvasProvider } from "../../store/CanvasProvider";
import { inputManager } from "../../inputs/InputManager";

// --- Custom Hooks (邏輯分離) ---
import { useArrangeModeInput } from "../../hooks/useArrangeModeInput";
import { usePlayModeInput } from "../../hooks/usePlayModeInput";
import { useApproachCircles } from "../../hooks/useApproachCircles";

declare global {
  interface Window {
    __currentGameTime?: number;
    __activeTouches?: number;
    __panStart?: { x: number; y: number } | null;
  }
}

// ==========================================
// Sub-Components
// ==========================================

interface ApproachCircleProps {
  x: number;
  y: number;
  progress: number;
  color: number;
}

const ApproachCircleComponent: React.FC<ApproachCircleProps> = ({
  x,
  y,
  progress,
  color,
}) => {
  const gRef = useRef<PIXI.Graphics>(null);
  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      const size = 60 + (1 - progress) * 150;
      const alpha = Math.min(1, progress * 2);
      const offset = (size - 60) / 2;
      g.roundRect(-offset, -offset, size, size, 8);
      g.stroke({ width: 4, color, alpha });
    },
    [progress, color],
  );

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics ref={gRef} draw={draw} />
    </pixiContainer>
  );
};

const TickerSync: React.FC<{ handleTick: () => void }> = ({ handleTick }) => {
  useTick(handleTick);
  return null;
};

// ==========================================
// Main Component
// ==========================================

export const GameCanvas: React.FC = () => {
  const { blocks: gameBlocks, camera, gamePhase } = useGameStore();
  const { showGrid, theme } = useSettingsStore();
  const isMobile = useIsMobile();
  const hasPausedRef = useRef(false);

  // 1. 畫布互動核心 (Trail, Pan, Selection)
  const {
    isPanningRef,
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

  // 2. 遊戲迴圈與打擊判定
  const { activeCirclesState, handleTick, checkTrailIntersection } =
    useApproachCircles(intersectedBlocksRef);

  // 3. 遊玩模式輸入 (十字準星、鍵盤打擊等)
  usePlayModeInput({
    gamePhase,
    isMobile,
    startTrail,
    updateTrail,
    endTrail,
    checkTrailIntersection,
    intersectedBlocksRef,
  });

  // 4. 編輯模式輸入 (手機雙指縮放、長按右鍵)
  const { isMobileRightClickRef } = useArrangeModeInput({
    isMobile,
    startTrail,
    updateTrail,
    checkTrailIntersection,
    intersectedBlocksRef,
    isPanningRef,
    currentStrokeId,
  });

  // 攝影機管理
  useCanvasCamera({
    isPerformMode: gamePhase === "play",
    isActive: gamePhase === "arrange" || gamePhase === "play",
    isGameCanvas: true,
    onWheelIntercept: (e) =>
      !!(e.target as HTMLElement)?.closest(
        ".settings-panel, .tutorial-overlay",
      ),
  });

  // 全域釋放事件 (防止暫停卡住)
  useEffect(() => {
    const handleGlobalUp = () => {
      if (hasPausedRef.current) {
        useStore.temporal.getState().resume();
        hasPausedRef.current = false;
      }
    };
    return inputManager.on("pointerup", handleGlobalUp);
  }, []);

  // --- PIXI 畫布原生事件綁定 (純視覺互動) ---
  const handlePixiPointerDown = (e: PIXI.FederatedPointerEvent) => {
    useStore.getState().setInteractionContext("main");
    if (gamePhase !== "arrange") return;

    if (e.button === 1) {
      startPan(
        e.global.x,
        e.global.y,
        useGameStore.getState().camera.x,
        useGameStore.getState().camera.y,
      );
    } else if (e.button === 0 && e.target && e.target.label === "background") {
      useGameStore.getState().closeContextMenu();
      if (isMobile) {
        startPan(
          e.global.x,
          e.global.y,
          useGameStore.getState().camera.x,
          useGameStore.getState().camera.y,
        );
      } else {
        useGameStore.getState().clearSelection();
        startSelection(
          e.currentTarget.toLocal(e.global).x,
          e.currentTarget.toLocal(e.global).y,
        );
        trySetPointerCapture(e.target, e.pointerId);
      }
    } else if (e.button === 2) {
      useGameStore.getState().closeContextMenu();
      useGameStore.getState().clearSelection();
      const gc = useGameStore.getState().camera;
      const localX = (e.global.x - gc.x) / gc.zoom;
      const localY = (e.global.y - gc.y) / gc.zoom;
      intersectedBlocksRef.current.clear();
      startTrail(localX, localY);
      checkTrailIntersection(localX, localY, localX, localY);
    }
  };

  const handlePixiPointerMove = (e: PIXI.FederatedPointerEvent) => {
    if (gamePhase === "arrange" && isSelectingRef.current) {
      const box = updateSelection(
        e.currentTarget.toLocal(e.global).x,
        e.currentTarget.toLocal(e.global).y,
      );
      if (!box) return;
      const { x, y, w, h } = box;
      const gs = useGameStore.getState();

      const directlySelectedBlocks = gs.blocks.filter(
        (b) => b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y,
      );
      const directlySelectedGroups = gs.groupRects.filter(
        (g) => g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y,
      );
      const activeGroupIds = new Set([
        ...directlySelectedBlocks
          .filter((b) => b.groupId)
          .map((b) => b.groupId as string),
        ...directlySelectedGroups
          .filter((g) => g.groupId)
          .map((g) => g.groupId as string),
      ]);

      useGameStore.setState({
        selectedBlockIds: gs.blocks
          .filter(
            (b) =>
              directlySelectedBlocks.includes(b) ||
              (b.groupId && activeGroupIds.has(b.groupId)),
          )
          .map((b) => b.id),
        selectedGroupRectIds: gs.groupRects
          .filter(
            (g) =>
              directlySelectedGroups.includes(g) ||
              (g.groupId && activeGroupIds.has(g.groupId)),
          )
          .map((g) => g.id),
      });
    } else if (
      gamePhase === "arrange" &&
      e.buttons === 2 &&
      !useGameStore.getState().activeNodeDrag
    ) {
      const gc = useGameStore.getState().camera;
      updateTrail(
        (e.global.x - gc.x) / gc.zoom,
        (e.global.y - gc.y) / gc.zoom,
        (p1, p2) => checkTrailIntersection(p1.x, p1.y, p2.x, p2.y),
      );
    } else if (gamePhase === "arrange" && isPanningRef.current && !isMobile) {
      updatePan(e.global.x, e.global.y, useGameStore.getState().updateCamera);
    }

    if (
      e.buttons === 4 ||
      (isMobile && gamePhase === "arrange" && inputManager.pointerCount === 2)
    ) {
      updatePan(e.clientX, e.clientY, useGameStore.getState().updateCamera);
    }
  };

  const handlePixiPointerUp = (e: PIXI.FederatedPointerEvent) => {
    endSelection();
    endPan();
    if (isMobileRightClickRef) isMobileRightClickRef.current = false;
    endTrail();
    intersectedBlocksRef.current.clear();
    tryReleasePointerCapture(e.target, e.pointerId);
  };

  return (
    <CanvasProvider type="game">
      <Application backgroundAlpha={0} resizeTo={window} antialias={true}>
        <TickerSync handleTick={handleTick} />
        <pixiContainer
          x={camera.x}
          y={camera.y}
          scale={camera.zoom}
          eventMode="static"
          onPointerDown={handlePixiPointerDown}
          onPointerMove={handlePixiPointerMove}
          onPointerUp={handlePixiPointerUp}
          onPointerUpOutside={handlePixiPointerUp}
        >
          <GridBackground
            showGrid={showGrid}
            theme={theme}
            zoom={camera.zoom}
          />
          <SelectionBoxRenderer
            selectionBox={selectionBox}
            zoom={camera.zoom}
          />
          <GroupRectRenderer />

          {gameBlocks.map((b) => (
            <NoteBlock
              key={b.id}
              id={b.id}
              x={b.x}
              y={b.y}
              pitch={b.pitch}
              volume={b.volume}
              instrument={b.instrument}
              playedAt={b.playedAt}
              playedVolumeMultiplier={b.playedVolumeMultiplier}
              playedPitchOffset={b.playedPitchOffset}
              canvasContext="game"
            />
          ))}

          {gamePhase === "play" &&
            activeCirclesState.map((circle) => (
              <ApproachCircleComponent
                key={circle.id}
                x={circle.x}
                y={circle.y}
                progress={circle.progress}
                color={circle.color}
              />
            ))}

          {(gamePhase === "play" || gamePhase === "arrange") && (
            <TrailRenderer
              activeStrokesRef={activeStrokesRef}
              currentStrokeId={currentStrokeId}
            />
          )}
        </pixiContainer>
      </Application>
    </CanvasProvider>
  );
};
