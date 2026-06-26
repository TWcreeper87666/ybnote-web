import React from "react";
import { useStore } from "../../store/useStore";
import { useLevelEditorStore } from "../../store/useLevelEditorStore";
import { useGameStore } from "../../store/useGameStore";
import { useCanvasContext } from "../canvas/CanvasContext";
import { useSettingsStore } from "../../store/useSettingsStore";
import { BaseBlock } from "./BaseBlock";
import { DrumBlock } from "./DrumBlock";
import { getPitchColorNumber } from "../../utils/colors";

interface PocketNoteBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
  instrument: string;
  volume: number;
  playedAt?: number;
}

export const PocketNoteBlock: React.FC<PocketNoteBlockProps> = ({
  id,
  x,
  y,
  pitch,
  instrument,
  volume,
  playedAt,
}) => {
  const selectedPocketBlockIds = useStore(
    (state) => state.selectedPocketBlockIds,
  );
  const isSelected = selectedPocketBlockIds.includes(id);
  const selectPocketBlock = useStore((state) => state.selectPocketBlock);

  const blockOpacity = 1;
  const showBlockPitch = true;
  const showBlockVolume = false;
  const showBlockInstrument = true;

  const pianoKeysCount = useSettingsStore((state) => state.pianoKeysCount);
  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);

  const canvasContext = useCanvasContext();
  const playgroundBlocks = useStore(state => state.blocks);
  const editorBlocks = useLevelEditorStore(state => state.blocks);
  const gameBlocks = useGameStore(state => state.blocks);
  const mainBlocks = canvasContext === 'editor' ? editorBlocks
    : canvasContext === 'game' ? gameBlocks
    : playgroundBlocks;
  const isMissingOnMain = !mainBlocks.some(
    b => b.pitch === pitch && (b.instrument || 'piano') === instrument,
  );

  const handlePointerDown = (
    e: import("pixi.js").FederatedPointerEvent | React.PointerEvent,
  ) => {
    const ev = e as unknown as {
      data?: { button?: number; global: { x: number; y: number } };
      nativeEvent?: PointerEvent;
      button?: number;
      stopPropagation: () => void;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      metaKey?: boolean;
      currentTarget: {
        parent: {
          toLocal: (pos: { x: number; y: number }) => { x: number; y: number };
        };
      };
      clientX?: number;
      clientY?: number;
      client?: { x: number; y: number };
    };
    const button = ev.data?.button ?? ev.nativeEvent?.button ?? ev.button;
    if (button === 2 || button === 1) {
      return; // Let right/middle click bubble up
    }

    ev.stopPropagation();
    const isMulti = ev.ctrlKey || ev.shiftKey || ev.metaKey;

    if (isMulti) {
      selectPocketBlock(id, true);
    } else if (!isSelected) {
      selectPocketBlock(id, false);
    }

    // Store local click offset
    const localPos = ev.currentTarget.parent.toLocal(
      ev.data?.global ?? { x: 0, y: 0 },
    );
    const offsetX = localPos.x - x;
    const offsetY = localPos.y - y;

    const startX =
      ev.clientX ??
      ev.nativeEvent?.clientX ??
      ev.client?.x ??
      (ev.data && ev.data.global.x) ??
      0;
    const startY =
      ev.clientY ??
      ev.nativeEvent?.clientY ??
      ev.client?.y ??
      (ev.data && ev.data.global.y) ??
      0;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);

        const currentState = useStore.getState();
        // Include this block if it somehow wasn't selected (though it should be)
        let selectedIds = currentState.selectedPocketBlockIds;
        if (!selectedIds.includes(id)) {
          selectedIds = [...selectedIds, id];
          currentState.selectPocketBlock(id, true);
        }

        const draggedBlocks = currentState.arrangedPocketBlocks.filter((b) =>
          selectedIds.includes(b.id),
        );
        currentState.setActivePocketDrag({
          offsetX,
          offsetY,
          blocks: draggedBlocks,
          clickedBlockId: id,
          initialX: moveEvent.clientX,
          initialY: moveEvent.clientY,
        });
      }
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const BlockComponent = instrument === "percussion" ? DrumBlock : BaseBlock;

  return (
    <BlockComponent
      id={id}
      x={x}
      y={y}
      pitch={pitch}
      instrument={instrument}
      volume={volume}
      blockColor={blockColor}
      opacity={blockOpacity}
      isSelected={isSelected}
      showPitch={showBlockPitch}
      showInstrument={showBlockInstrument}
      showVolume={showBlockVolume}
      isInteractive={true}
      onPointerDown={handlePointerDown}
      // If it's missing, we use isInvalid to draw the red outline. BaseBlock supports this.
      isInvalid={isMissingOnMain}
      playedAt={playedAt}
    />
  );
};
