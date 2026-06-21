import { useRef, useState, useCallback } from 'react';
import type { TrailStroke } from '../components/canvas/shared/TrailRenderer';

export const useCanvasInteractions = () => {
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const selectionStartRef = useRef<{x: number, y: number} | null>(null);
  const isSelectingRef = useRef(false);

  const activeStrokesRef = useRef<TrailStroke[]>([]);
  const currentStrokeId = useRef<number | null>(null);
  const nextStrokeId = useRef(0);
  const isTrailingRef = useRef(false);
  
  const intersectedBlocksRef = useRef<Set<string>>(new Set());

  const startPan = useCallback((x: number, y: number, cameraX: number, cameraY: number) => {
    isPanningRef.current = true;
    panStartRef.current = { x: x - cameraX, y: y - cameraY };
  }, []);

  const updatePan = useCallback((x: number, y: number, updateCamera: (cam: any) => void) => {
    if (isPanningRef.current) {
      updateCamera({
        x: x - panStartRef.current.x,
        y: y - panStartRef.current.y,
      });
      return true;
    }
    return false;
  }, []);

  const endPan = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const startSelection = useCallback((x: number, y: number) => {
    isSelectingRef.current = true;
    selectionStartRef.current = { x, y };
    setSelectionBox({ x, y, w: 0, h: 0 });
  }, []);

  const updateSelection = useCallback((x: number, y: number) => {
    if (selectionStartRef.current) {
      const start = selectionStartRef.current;
      const newX = Math.min(start.x, x);
      const newY = Math.min(start.y, y);
      const w = Math.abs(x - start.x);
      const h = Math.abs(y - start.y);
      setSelectionBox({ x: newX, y: newY, w, h });
      return { x: newX, y: newY, w, h };
    }
    return null;
  }, []);

  const endSelection = useCallback(() => {
    isSelectingRef.current = false;
    selectionStartRef.current = null;
    setSelectionBox(null);
  }, []);

  const startTrail = useCallback((localX: number, localY: number) => {
    isTrailingRef.current = true;
    const id = nextStrokeId.current++;
    currentStrokeId.current = id;
    activeStrokesRef.current.push({
      id,
      points: [{ x: localX, y: localY, time: Date.now() }]
    });
  }, []);

  const updateTrail = useCallback((localX: number, localY: number, onIntersect?: (p1: any, p2: any) => void) => {
    if (currentStrokeId.current !== null) {
      const stroke = activeStrokesRef.current.find(s => s.id === currentStrokeId.current);
      if (stroke && stroke.points.length > 0) {
        const prev = stroke.points[stroke.points.length - 1];
        if (Math.hypot(localX - prev.x, localY - prev.y) > 2) {
          stroke.points.push({ x: localX, y: localY, time: Date.now() });
          if (onIntersect) onIntersect(prev, { x: localX, y: localY });
        }
      }
      return true;
    }
    return false;
  }, []);

  const endTrail = useCallback(() => {
    isTrailingRef.current = false;
    currentStrokeId.current = null;
  }, []);

  return {
    isPanningRef,
    panStartRef,
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
    endTrail,
    intersectedBlocksRef,
    isSelectingRef,
    isTrailingRef
  };
};
