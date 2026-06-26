import { useState, useRef, useEffect } from 'react';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { getCanvasAdapter } from '../store/canvasAdapter';
import { snapValue } from '../utils/canvasUtils';
import { createDragHistoryGuard } from '../utils/dragUtils';
import { useDoubleClick } from './useDoubleClick';
import { getAllChartNotes } from '../utils/chartUtils';
import { useIsMobile } from './useIsMobile';
import { useCanvasContext } from '../components/canvas/CanvasContext';
import type { CanvasContextType } from '../components/canvas/CanvasContext';
import {
  getBlocksForContext, getCameraForContext,
  getSelectedBlockIdsForContext, getSelectedTrackIdsForContext, getSelectedGroupRectIdsForContext,
  getTracksForContext, getGroupRectsForContext,
  selectBlockInContext, clearSelectionInContext, openContextMenuInContext, getContextMenuForContext, closeContextMenuInContext,
  updateTrackInContext, updateGroupRectInContext,
} from './useActiveCanvas';

export const useBlockDrag = (id: string, x: number, y: number, isSelected: boolean, canvasContextOverride?: CanvasContextType) => {
  const isMobile = useIsMobile();
  const canvasContextFromHook = useCanvasContext();
  const canvasContext = canvasContextOverride ?? canvasContextFromHook;
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const clickStartPosRef = useRef<{x: number, y: number, pointerId?: number} | null>(null);
  const wasSelectedRef = useRef(false);
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

    const button = e.button;
    const isMultiSelect = e.ctrlKey || e.shiftKey;

    if (button === 0) {
      const ctxMenu = getContextMenuForContext(canvasContext);
      if (ctxMenu && ctxMenu.blockId !== id) {
        closeContextMenuInContext(canvasContext);
      }
      e.stopPropagation();
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      let shouldDrag: boolean;
      if (isMultiSelect) {
        selectBlockInContext(canvasContext, id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          selectBlockInContext(canvasContext, id, false);
        }
        shouldDrag = true;
      }

      if (shouldDrag) {
        setIsDragging(true);
        const pos = e.currentTarget.parent?.toLocal(e.global) || { x: e.global.x, y: e.global.y };
        setDragOffset({ x: pos.x - x, y: pos.y - y });
      }
    }
  };

  const handlePointerUp = (e: import('pixi.js').FederatedPointerEvent) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      const isClick = Math.sqrt(dx*dx + dy*dy) < 5;
      if (isClick && isDoubleClick()) {
        if (!e.ctrlKey && !e.shiftKey) {
          openContextMenuInContext(canvasContext, { x: e.clientX, y: e.clientY, blockId: id });
        }
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const adapter = getCanvasAdapter(canvasContext);
    const selectedIds = getSelectedBlockIdsForContext(canvasContext);
    const sourceBlocks = getBlocksForContext(canvasContext).filter(b => selectedIds.includes(b.id));

    if (!sourceBlocks.find(b => b.id === id)) {
      const thisBlock = getBlocksForContext(canvasContext).find(b => b.id === id);
      if (thisBlock) sourceBlocks.push(thisBlock);
    }

    const selectedTrackIds = getSelectedTrackIdsForContext(canvasContext);
    const selectedGroupRectIds = getSelectedGroupRectIdsForContext(canvasContext);
    const selectedTracks = getTracksForContext(canvasContext).filter(t => selectedTrackIds.includes(t.id));
    const selectedGroupRects = getGroupRectsForContext(canvasContext).filter(g => selectedGroupRectIds.includes(g.id));

    const initialPositions = new Map(sourceBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({ ...n }))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const historyGuard = createDragHistoryGuard(adapter);

    const handleGlobalMove = (e: PointerEvent) => {
      if (clickStartPosRef.current && clickStartPosRef.current.pointerId !== undefined && e.pointerId !== clickStartPosRef.current.pointerId) {
        return;
      }
      if (isMobile && (window as { __activeTouches?: number }).__activeTouches && (window as { __activeTouches?: number }).__activeTouches! > 1) {
        setIsDragging(false);
        historyGuard.onUp();
        clearSelectionInContext(canvasContext);
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

      if (snapToGrid) {
        newX = snapValue(newX);
        newY = snapValue(newY);
      }

      const thisInit = initialPositions.get(id);
      if (!thisInit) return;

      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;

      const finalUpdates = sourceBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
      });

      historyGuard.onMove();
      adapter.updateBlocks(finalUpdates);

      const trackUpdates = selectedTracks.map(t => {
        const initNodes = initialTrackNodes.get(t.id)!;
        return { id: t.id, nodes: initNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) };
      });
      trackUpdates.forEach(tu => updateTrackInContext(canvasContext, tu.id, { nodes: tu.nodes }));
      selectedGroupRects.forEach(g => {
        const init = initialGroupRects.get(g.id)!;
        updateGroupRectInContext(canvasContext, g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
      historyGuard.onUp();
      if (isMobile) clearSelectionInContext(canvasContext);
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
  }, [isDragging, dragOffset, id, isMobile, canvasContext]);

  return { handlePointerDown, handlePointerUp, isDragging };
};
