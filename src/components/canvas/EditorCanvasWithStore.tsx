import React from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useCanvasInteractions } from "../../hooks/useCanvasInteractions";
import { EditorCanvas } from "./EditorCanvas";
import { useSettingsStore } from "../../store";

/**
 * EditorCanvas wrapper that uses useCanvasStore for blocks and canvas state
 */
export const EditorCanvasWithStore: React.FC = () => {
  const { blocks, camera } = useCanvasStore((s) => s);
  const { theme, showGrid } = useSettingsStore();

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
    intersectedBlocksRef,
    isSelectingRef,
  } = useCanvasInteractions();

  const interactions = {
    startPan,
    updatePan,
    endPan,
    startSelection,
    updateSelection,
    endSelection,
    startTrail,
    updateTrail,
    isSelectingRef,
  };

  return (
    <EditorCanvas
      camera={camera}
      blocks={blocks}
      theme={theme}
      showGrid={showGrid}
      selectionBox={selectionBox}
      activeStrokesRef={activeStrokesRef}
      currentStrokeId={currentStrokeId}
      intersectedBlocksRef={intersectedBlocksRef}
      interactions={interactions}
    />
  );
};
