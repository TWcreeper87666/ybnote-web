import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { useStore } from '../../../store/useStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { getCanvasState } from '../../../store/canvasAdapter';
import { getCanvasCenterLocal } from '../../../utils/canvasUtils';
import type { CanvasContextType } from '../CanvasContext';

interface PlayToolDeps {
  checkIntersection: (x1: number, y1: number, x2: number, y2: number, isFirstPoint?: boolean, startedOnBlock?: boolean) => void;
  intersectedBlocksRef: MutableRefObject<Set<string>>;
}

export function usePlayTool(
  context: 'playground' | 'editor',
  { checkIntersection, intersectedBlocksRef }: PlayToolDeps
) {
  const mode = useStore(s => s.mode);

  useEffect(() => {
    if (mode === 'play') {
      document.body.requestPointerLock().catch(() => {});
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [mode]);

  useEffect(() => {
    const onLockChange = () => {
      if (document.pointerLockElement !== document.body && useStore.getState().mode === 'play') {
        useStore.getState().setMode('select');
      }
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  useEffect(() => {
    if (mode !== 'play') return;
    let rafId: number | null = null;
    let pendingX = 0;
    let pendingY = 0;
    let mouseButtons = 0;
    let xzDown = false;

    const isTriggered = () => mouseButtons > 0 || xzDown;

    const fireInitialHit = () => {
      const canvas = getCanvasState(context);
      const { x: cx, y: cy } = getCanvasCenterLocal(context as CanvasContextType);
      const lx = (cx - canvas.camera.x) / canvas.camera.zoom;
      const ly = (cy - canvas.camera.y) / canvas.camera.zoom;
      let startedOnBlock = false;
      for (const b of canvas.blocks) {
        if (lx >= b.x && lx <= b.x + 60 && ly >= b.y && ly <= b.y + 60) { startedOnBlock = true; break; }
      }
      intersectedBlocksRef.current.clear();
      checkIntersection(lx, ly, lx, ly, true, startedOnBlock);
    };

    const onMove = (e: MouseEvent) => {
      pendingX += e.movementX;
      pendingY += e.movementY;
      mouseButtons = e.buttons;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          const canvas = getCanvasState(context);
          const { mouseSensitivity } = useSettingsStore.getState();
          const newCamX = canvas.camera.x - pendingX * mouseSensitivity;
          const newCamY = canvas.camera.y - pendingY * mouseSensitivity;
          if (isTriggered() && (pendingX !== 0 || pendingY !== 0)) {
            const { x: cx, y: cy } = getCanvasCenterLocal(context as CanvasContextType);
            checkIntersection(
              (cx - canvas.camera.x) / canvas.camera.zoom, (cy - canvas.camera.y) / canvas.camera.zoom,
              (cx - newCamX) / canvas.camera.zoom, (cy - newCamY) / canvas.camera.zoom,
              false, false
            );
          }
          canvas.updateCamera({ x: newCamX, y: newCamY });
          pendingX = 0; pendingY = 0; mouseButtons = 0; rafId = null;
        });
      }
    };

    const onDown = () => {
      fireInitialHit();
    };

    const onUp = (e: MouseEvent) => {
      if (e.buttons === 0 && !xzDown) intersectedBlocksRef.current.clear();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== 'x' && e.key !== 'X' && e.key !== 'z' && e.key !== 'Z') return;
      xzDown = true;
      fireInitialHit();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'x' || e.key === 'X' || e.key === 'z' || e.key === 'Z') {
        xzDown = false;
        if (mouseButtons === 0) intersectedBlocksRef.current.clear();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mode, checkIntersection, intersectedBlocksRef, context]);
}
