import type { CanvasContextType } from '../components/canvas/CanvasContext';

export const snapValue = (v: number, size = 30) => Math.round(v / size) * size;

export const clampZoom = (zoom: number, min = 0.1, max = 5) => Math.min(Math.max(zoom, min), max);

export const getTouchDistance = (t1: Touch, t2: Touch) =>
  Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);

export const trySetPointerCapture = (target: unknown, pointerId?: number) => {
  if (pointerId === undefined) return;
  (target as { setPointerCapture?(id: number): void }).setPointerCapture?.(pointerId);
};

export const tryReleasePointerCapture = (target: unknown, pointerId?: number) => {
  if (pointerId === undefined) return;
  try {
    (target as { releasePointerCapture?(id: number): void }).releasePointerCapture?.(pointerId);
  } catch { /* ignore */ }
};

/**
 * Returns the bounding rect of the visible canvas area for the given context.
 * Falls back to the full window if no specific container is found.
 */
export const getCanvasContainerRect = (context?: CanvasContextType): DOMRect | { left: number; top: number; width: number; height: number } => {
  if (context === 'editor') {
    const el = document.querySelector('.le-blocks-container');
    if (el) return el.getBoundingClientRect();
  }
  if (context === 'game') {
    const el = document.querySelector('.game-canvas-wrapper') ?? document.querySelector('.game-container');
    if (el) return el.getBoundingClientRect();
  }
  // Playground or fallback: canvas fills the window
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
};

/**
 * Returns the pixel center of the visible canvas area in viewport coordinates.
 */
export const getCanvasCenter = (context?: CanvasContextType): { x: number; y: number } => {
  const rect = getCanvasContainerRect(context);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

/**
 * Returns the center of the visible canvas area in canvas-element-local coordinates
 * (i.e. with the Pixi canvas element's offset subtracted). Use this when converting
 * to world/camera space, because camera.x/y are stored relative to the canvas element's
 * top-left, not the viewport — matching the pattern used in useBlockDrag and useCanvasCamera.
 */
export const getCanvasCenterLocal = (context?: CanvasContextType): { x: number; y: number } => {
  const containerRect = getCanvasContainerRect(context);

  let canvasLeft = 0;
  let canvasTop = 0;

  if (context === 'editor') {
    const el = document.querySelector('.le-blocks-container canvas');
    if (el) {
      const r = el.getBoundingClientRect();
      canvasLeft = r.left;
      canvasTop = r.top;
    }
  } else if (context === 'game') {
    const el = document.querySelector('.game-canvas-wrapper canvas') ?? document.querySelector('.game-container canvas');
    if (el) {
      const r = el.getBoundingClientRect();
      canvasLeft = r.left;
      canvasTop = r.top;
    }
  }

  return {
    x: containerRect.left + containerRect.width / 2 - canvasLeft,
    y: containerRect.top + containerRect.height / 2 - canvasTop,
  };
};
