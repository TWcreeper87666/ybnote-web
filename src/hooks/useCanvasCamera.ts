import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useGameStore } from '../store/useGameStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { getCanvasCenter, clampZoom } from '../utils/canvasUtils';

interface UseCanvasCameraOptions {
  isPerformMode: boolean;
  isActive: boolean;
  isGameCanvas?: boolean;
  isEditorCanvas?: boolean;
  onWheelIntercept?: (e: WheelEvent) => boolean;
}

export const useCanvasCamera = ({ isPerformMode, isActive, isGameCanvas, isEditorCanvas, onWheelIntercept }: UseCanvasCameraOptions) => {
  // Desktop Wheel
  useEffect(() => {
    if (!isActive) return;

    const handler = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      if (onWheelIntercept && onWheelIntercept(e)) return;

      e.preventDefault();
      const state = useStore.getState();
      const activeCamera = isGameCanvas
        ? useGameStore.getState().camera
        : isEditorCanvas
          ? useLevelEditorStore.getState().camera
          : state.camera;
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;

      const oldZoom = activeCamera.zoom;
      const newZoom = clampZoom(oldZoom * direction);

      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };

      const context = isGameCanvas ? 'game' : isEditorCanvas ? 'editor' : 'playground';
      const center = isPerformMode ? getCanvasCenter(context) : null;
      const globalX = isPerformMode ? center!.x - rect.left : e.clientX - rect.left;
      const globalY = isPerformMode ? center!.y - rect.top : e.clientY - rect.top;

      const localX = (globalX - activeCamera.x) / oldZoom;
      const localY = (globalY - activeCamera.y) / oldZoom;

      const newCameraX = globalX - localX * newZoom;
      const newCameraY = globalY - localY * newZoom;

      if (isGameCanvas) {
         useGameStore.getState().updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      } else if (isEditorCanvas) {
         useLevelEditorStore.getState().updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      } else {
         state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      }
    };

    document.addEventListener('wheel', handler, { passive: false });
    return () => document.removeEventListener('wheel', handler);
  }, [isActive, isPerformMode, onWheelIntercept, isGameCanvas]);


};
