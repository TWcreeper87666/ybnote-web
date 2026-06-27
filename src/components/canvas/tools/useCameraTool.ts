import type { FederatedPointerEvent } from 'pixi.js';
import { getCanvasState } from '../../../store/canvasAdapter';

interface CameraToolDeps {
  startPan: (x: number, y: number, cameraX: number, cameraY: number) => void;
  updatePan: (x: number, y: number, updateCamera: (cam: { x: number; y: number }) => void) => boolean;
  endPan: () => void;
}

export function useCameraTool(
  context: 'playground' | 'editor',
  { startPan, updatePan, endPan }: CameraToolDeps
) {
  const onPointerDown = (e: FederatedPointerEvent): boolean => {
    if (e.button !== 1) return false;
    const { camera } = getCanvasState(context);
    startPan(e.global.x, e.global.y, camera.x, camera.y);
    return true;
  };

  const onPointerMove = (e: FederatedPointerEvent): boolean => {
    return updatePan(e.global.x, e.global.y, getCanvasState(context).updateCamera);
  };

  const onPointerUp = (): void => {
    endPan();
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
