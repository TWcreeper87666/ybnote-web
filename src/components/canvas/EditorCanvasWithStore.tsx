import React, { useEffect, useContext } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useCanvasInteractions } from "../../hooks/useCanvasInteractions";
import { EditorCanvas } from "./EditorCanvas";
import { useSettingsStore } from "../../store";
import { CanvasStoreContext } from "../../store/CanvasStoreContext";

/**
 * EditorCanvas wrapper that uses useCanvasStore for blocks and canvas state
 */
export const EditorCanvasWithStore: React.FC = () => {
  const { blocks, camera } = useCanvasStore((s) => s);
  const { theme, showGrid, mouseSensitivity } = useSettingsStore();
  const canvasStoreCtx = useContext(CanvasStoreContext);

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

  // Wheel zoom — zoom toward cursor position using the canvas context store
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.settings-panel, .tutorial-overlay, .glass-panel')) return;
      e.preventDefault();

      const cs = canvasStoreCtx?.getState() as any;
      if (!cs) return;

      const activeCamera = cs.camera;
      const sensitivity = mouseSensitivity ?? 1;
      const zoomFactor = 1.1 * sensitivity;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;

      const oldZoom = activeCamera.zoom;
      const newZoom = Math.min(Math.max(oldZoom * direction, 0.1), 5);

      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const globalX = e.clientX - rect.left;
      const globalY = e.clientY - rect.top;

      const localX = (globalX - activeCamera.x) / oldZoom;
      const localY = (globalY - activeCamera.y) / oldZoom;

      cs.updateCamera({
        zoom: newZoom,
        x: globalX - localX * newZoom,
        y: globalY - localY * newZoom,
      });
    };

    document.addEventListener('wheel', handler, { passive: false });
    return () => document.removeEventListener('wheel', handler);
  }, [canvasStoreCtx, mouseSensitivity]);

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
