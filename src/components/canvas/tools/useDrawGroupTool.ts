import { useState, useRef, useCallback, useEffect } from 'react';
import type { FederatedPointerEvent, Container } from 'pixi.js';
import { trySetPointerCapture } from '../../../utils/canvasUtils';
import { getCanvasState } from '../../../store/canvasAdapter';
type Box = { x: number; y: number; w: number; h: number };

export function useDrawGroupTool(context: 'playground' | 'editor') {
  const [groupDrawBox, setGroupDrawBox] = useState<Box | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<Box | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{ x: number; y: number } | null>(null);

  const finish = useCallback(() => {
    const box = boxRef.current;
    if (box && box.w > 10 && box.h > 10) {
      const canvas = getCanvasState(context);
      const id = canvas.addGroupRect({ x: box.x, y: box.y, w: box.w, h: box.h });
      canvas.selectGroupRect(id, false);
    }
    boxRef.current = null;
    setGroupDrawBox(null);
    startRef.current = null;
  }, [context]);

  useEffect(() => {
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [finish]);

  const onPointerDown = (e: FederatedPointerEvent): boolean => {
    if ((e.target as Container | null)?.label !== 'background') return false;
    const canvas = getCanvasState(context);
    const now = Date.now();
    const pos = (e.currentTarget as Container).toLocal(e.global);
    const timeDiff = now - lastClickTimeRef.current;

    if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
      if (Math.hypot(pos.x - lastClickPosRef.current.x, pos.y - lastClickPosRef.current.y) < 20) {
        const g = canvas.groupRects.find(gr => gr.id === canvas.lastSelectedId);
        const w = g?.w || 200;
        const h = g?.h || 200;
        let nameToCopy = g?.name;
        if (nameToCopy?.startsWith('Group ')) nameToCopy = undefined;
        const id = canvas.addGroupRect({ x: pos.x - w / 2, y: pos.y - h / 2, w, h, name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding });
        canvas.selectGroupRect(id, false);
        lastClickTimeRef.current = 0;
        return true;
      }
    }

    lastClickTimeRef.current = now;
    lastClickPosRef.current = { x: pos.x, y: pos.y };
    startRef.current = { x: pos.x, y: pos.y };
    const newBox = { x: pos.x, y: pos.y, w: 0, h: 0 };
    setGroupDrawBox(newBox);
    boxRef.current = newBox;
    trySetPointerCapture(e.target, e.pointerId);
    return true;
  };

  const onPointerMove = (e: FederatedPointerEvent): boolean => {
    if (!startRef.current) return false;
    const pos = (e.currentTarget as Container).toLocal(e.global);
    const { x: sx, y: sy } = startRef.current;
    const newBox = { x: Math.min(sx, pos.x), y: Math.min(sy, pos.y), w: Math.abs(pos.x - sx), h: Math.abs(pos.y - sy) };
    setGroupDrawBox(newBox);
    boxRef.current = newBox;
    return true;
  };

  const onPointerUp = (): void => {
    finish();
  };

  return { groupDrawBox, onPointerDown, onPointerMove, onPointerUp };
}
