import { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';

type PocketPointerEvent = {
  clientX: number;
  clientY: number;
  currentTarget: { parent: { toLocal: (pos: { x: number; y: number }) => { x: number; y: number } } };
  global: { x: number; y: number };
};

export const usePocketCanvasInteractions = () => {
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  const selectionBoxRef = useRef<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const isSelectingRef = useRef(false);

  const startPan = useCallback((e: PocketPointerEvent) => {
    isPanningRef.current = true;
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
    useStore.getState().setInteractionContext('pocket');
  }, []);

  const updatePan = useCallback((e: PocketPointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPanPosRef.current.x;
    const dy = e.clientY - lastPanPosRef.current.y;
    
    const state = useStore.getState();
    useStore.getState().updatePocketCamera({
      x: state.pocketCamera.x + dx,
      y: state.pocketCamera.y + dy
    });
    
    lastPanPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const endPan = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const startSelection = useCallback((e: PocketPointerEvent) => {
    const pos = e.currentTarget.parent.toLocal(e.global);
    isSelectingRef.current = true;
    setSelectionBox({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
    useStore.getState().setInteractionContext('pocket');
  }, []);

  const updateSelection = useCallback((e: PocketPointerEvent) => {
    if (!isSelectingRef.current) return;
    const pos = e.currentTarget.parent.toLocal(e.global);
    setSelectionBox(prev => {
      const next = prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null;
      selectionBoxRef.current = next;
      return next;
    });
  }, []);

  const endSelection = useCallback(() => {
    if (!isSelectingRef.current || !selectionBox) return;
    
    // PocketCanvas.tsx handles intersection checking during global pointerup.
    isSelectingRef.current = false;
  }, [selectionBox]);

  const clearSelectionBox = useCallback(() => {
    setSelectionBox(null);
    selectionBoxRef.current = null;
  }, []);

  return {
    startPan, updatePan, endPan, isPanningRef,
    selectionBox, selectionBoxRef, startSelection, updateSelection, endSelection, clearSelectionBox
  };
};
