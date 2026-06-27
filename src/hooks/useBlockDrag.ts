import { useState, useRef, useEffect } from 'react';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { snapValue } from '../utils/canvasUtils';
import { useDoubleClick } from './useDoubleClick';
import { getAllChartNotes } from '../utils/chartUtils';
import { useIsMobile } from './useIsMobile';
import { useCanvasContext } from '../components/canvas/CanvasContext';
import type { CanvasContextType } from '../components/canvas/CanvasContext';
import {
  getCameraForContext, selectBlockInContext,
  getContextMenuForContext, closeContextMenuInContext,
} from './useActiveCanvas';

interface BlockDragHandlers {
  onMove: (deltaX: number, deltaY: number) => void;
  onUp: () => void;
}

interface BlockDragOptions {
  canvasContext?: CanvasContextType;
  onDragStart?: () => BlockDragHandlers | void;
  onContextMenu?: (pos: { x: number; y: number }) => void;
}

export const useBlockDrag = (
  id: string,
  x: number,
  y: number,
  isSelected: boolean,
  {
    canvasContext: canvasContextOverride,
    onDragStart,
    onContextMenu,
  }: BlockDragOptions = {}
) => {
  const isMobile = useIsMobile();
  const canvasContextFromHook = useCanvasContext();
  const canvasContext = canvasContextOverride ?? canvasContextFromHook;
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const clickStartPosRef = useRef<{ x: number; y: number; pointerId?: number } | null>(null);
  const initialPosRef = useRef({ x, y });
  const { isDoubleClick } = useDoubleClick();

  const handlePointerDown = (e: import('pixi.js').FederatedPointerEvent) => {
    if (canvasContext === 'game' && useGameStore.getState().gamePhase === 'play') return;

    const editorState = useLevelEditorStore.getState();
    if (editorState.activeTab === 'charting' && editorState.chartingAwaitingPick) {
      const chartNotes = editorState.midiData ? getAllChartNotes(editorState.midiData) : [];
      const entry = chartNotes[editorState.chartingNoteIndex];
      if (entry) {
        e.stopPropagation();
        editorState.assignNoteTarget(entry.note.id, entry.track.id, id, 'block');
        useLevelEditorStore.getState().togglePlayback();
        return;
      }
    }

    if (e.button !== 0) return;
    const isMultiSelect = e.ctrlKey || e.shiftKey;
    const ctxMenu = getContextMenuForContext(canvasContext);
    if (ctxMenu && ctxMenu.blockId !== id) closeContextMenuInContext(canvasContext);
    e.stopPropagation();
    clickStartPosRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };

    let shouldDrag: boolean;
    if (isMultiSelect) {
      selectBlockInContext(canvasContext, id, true);
      shouldDrag = !isSelected;
    } else {
      if (!isSelected) selectBlockInContext(canvasContext, id, false);
      shouldDrag = true;
    }

    if (shouldDrag) {
      initialPosRef.current = { x, y };
      setIsDragging(true);
      const pos = e.currentTarget.parent?.toLocal(e.global) || { x: e.global.x, y: e.global.y };
      setDragOffset({ x: pos.x - x, y: pos.y - y });
    }
  };

  const handlePointerUp = (e: import('pixi.js').FederatedPointerEvent) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5 && isDoubleClick()) {
        if (!e.ctrlKey && !e.shiftKey) onContextMenu?.({ x: e.clientX, y: e.clientY });
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const handlers = onDragStart?.() ?? null;

    const handleGlobalMove = (e: PointerEvent) => {
      if (clickStartPosRef.current?.pointerId !== undefined && e.pointerId !== clickStartPosRef.current.pointerId) return;
      if (isMobile && (window as { __activeTouches?: number }).__activeTouches! > 1) {
        setIsDragging(false);
        handlers?.onUp();
        return;
      }

      const camera = getCameraForContext(canvasContext);
      const { snapToGrid } = useSettingsStore.getState();
      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - rect.top - camera.y) / camera.zoom;

      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;
      if (snapToGrid) { newX = snapValue(newX); newY = snapValue(newY); }

      handlers?.onMove(newX - initialPosRef.current.x, newY - initialPosRef.current.y);
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
      handlers?.onUp();
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    window.addEventListener('contextmenu', handleGlobalUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      window.removeEventListener('contextmenu', handleGlobalUp);
    };
  }, [isDragging, dragOffset, isMobile, canvasContext, onDragStart]);

  return { handlePointerDown, handlePointerUp, isDragging };
};
