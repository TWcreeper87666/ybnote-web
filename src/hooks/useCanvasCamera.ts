import { useEffect } from 'react';
import { useStore } from '../store/useStore';

interface UseCanvasCameraOptions {
  isPlayMode: boolean;
  isActive: boolean;
  onWheelIntercept?: (e: WheelEvent) => boolean;
}

export const useCanvasCamera = ({ isPlayMode, isActive, onWheelIntercept }: UseCanvasCameraOptions) => {
  // Desktop Wheel
  useEffect(() => {
    if (!isActive) return;

    const handler = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      if (onWheelIntercept && onWheelIntercept(e)) return;
      
      e.preventDefault();
      const state = useStore.getState();
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
      
      const oldZoom = state.camera.zoom;
      let newZoom = oldZoom * direction;
      newZoom = Math.min(Math.max(newZoom, 0.1), 5); // Clamp zoom
      
      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      
      const mode = state.mobileControlMode;
      const isCrosshair = isPlayMode && mode === 'crosshair';
      const globalX = isCrosshair ? window.innerWidth / 2 : e.clientX - rect.left;
      const globalY = isCrosshair ? window.innerHeight / 2 : e.clientY - rect.top;
      
      const localX = (globalX - state.camera.x) / oldZoom;
      const localY = (globalY - state.camera.y) / oldZoom;
      
      const newCameraX = globalX - localX * newZoom;
      const newCameraY = globalY - localY * newZoom;

      state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
    };

    document.addEventListener('wheel', handler, { passive: false });
    return () => document.removeEventListener('wheel', handler);
  }, [isActive, isPlayMode, onWheelIntercept]);


};
