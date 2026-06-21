import { useEffect } from 'react';
import { useStore } from '../store/useStore';

interface UseCanvasCameraOptions {
  isMobile: boolean;
  isPlayMode: boolean;
  isActive: boolean;
  onWheelIntercept?: (e: WheelEvent) => boolean;
}

export const useCanvasCamera = ({ isMobile, isPlayMode, isActive, onWheelIntercept }: UseCanvasCameraOptions) => {
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
      
      const globalX = isPlayMode ? window.innerWidth / 2 : e.clientX - rect.left;
      const globalY = isPlayMode ? window.innerHeight / 2 : e.clientY - rect.top;
      
      const localX = (globalX - state.camera.x) / oldZoom;
      const localY = (globalY - state.camera.y) / oldZoom;
      
      const newCameraX = globalX - localX * newZoom;
      const newCameraY = globalY - localY * newZoom;

      state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
    };

    document.addEventListener('wheel', handler, { passive: false });
    return () => document.removeEventListener('wheel', handler);
  }, [isActive, isPlayMode, onWheelIntercept]);

  // Mobile Pinch Zoom
  useEffect(() => {
    if (!isMobile || !isActive) return;
    
    let initialPinchDist = 0;
    let initialZoom = 1;
    let initialLocalX = 0;
    let initialLocalY = 0;

    const trackTouches = (e: TouchEvent) => { 
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;

      if (e.type === 'touchstart') {
          if (e.touches.length >= 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              initialPinchDist = Math.sqrt(dx*dx + dy*dy);
              const state = useStore.getState();
              initialZoom = state.camera.zoom;
              const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
              initialLocalX = (centerX - rect.left - state.camera.x) / state.camera.zoom;
              initialLocalY = (centerY - rect.top - state.camera.y) / state.camera.zoom;
          }
      } else if (e.type === 'touchmove') {
          if (e.cancelable) e.preventDefault(); 
          
          if (e.touches.length >= 2 && initialPinchDist > 0) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const zoomFactor = dist / initialPinchDist;
              let newZoom = initialZoom * zoomFactor;
              newZoom = Math.min(Math.max(newZoom, 0.1), 5);
              const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
              const newCameraX = (currentCenterX - rect.left) - initialLocalX * newZoom;
              const newCameraY = (currentCenterY - rect.top) - initialLocalY * newZoom;
              useStore.getState().updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
          }
      } else {
          if (e.touches.length < 2) initialPinchDist = 0;
      }
    };
    
    window.addEventListener('touchstart', trackTouches, { passive: false });
    window.addEventListener('touchmove', trackTouches, { passive: false });
    window.addEventListener('touchend', trackTouches);
    window.addEventListener('touchcancel', trackTouches);

    return () => {
       window.removeEventListener('touchstart', trackTouches);
       window.removeEventListener('touchmove', trackTouches);
       window.removeEventListener('touchend', trackTouches);
       window.removeEventListener('touchcancel', trackTouches);
    };
  }, [isActive, isMobile]);
};
