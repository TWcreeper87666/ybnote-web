import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';

interface UseCanvasCameraOptions {
  isPlayMode: boolean;
  isActive: boolean;
  isGameCanvas?: boolean;
  onWheelIntercept?: (e: WheelEvent) => boolean;
}

export const useCanvasCamera = ({ isPlayMode, isActive, isGameCanvas, onWheelIntercept }: UseCanvasCameraOptions) => {
  // Desktop Wheel
  useEffect(() => {
    if (!isActive) return;

    const handler = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      if (onWheelIntercept && onWheelIntercept(e)) return;
      
      e.preventDefault();
      const state = useStore.getState();
      const activeCamera = isGameCanvas ? useGameStore.getState().gameCamera : state.camera;
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
      
      const oldZoom = activeCamera.zoom;
      let newZoom = oldZoom * direction;
      newZoom = Math.min(Math.max(newZoom, 0.1), 5); // Clamp zoom
      
      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      
      const mode = useSettingsStore.getState().mobileControlMode;
      const isCrosshair = isPlayMode && mode === 'crosshair';
      const globalX = isCrosshair ? window.innerWidth / 2 : e.clientX - rect.left;
      const globalY = isCrosshair ? window.innerHeight / 2 : e.clientY - rect.top;
      
      const localX = (globalX - activeCamera.x) / oldZoom;
      const localY = (globalY - activeCamera.y) / oldZoom;
      
      const newCameraX = globalX - localX * newZoom;
      const newCameraY = globalY - localY * newZoom;

      if (isGameCanvas) {
         useGameStore.getState().updateGameCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      } else {
         state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      }
    };

    document.addEventListener('wheel', handler, { passive: false });
    return () => document.removeEventListener('wheel', handler);
  }, [isActive, isPlayMode, onWheelIntercept, isGameCanvas]);


};
