import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { getAllChartNotes } from '../utils/chartUtils';
import { useIsMobile } from './useIsMobile';
import { useCanvasContext } from '../components/canvas/CanvasContext';
import type { CanvasContextType } from '../components/canvas/CanvasContext';

export const useBlockDrag = (id: string, x: number, y: number, isSelected: boolean, canvasContextOverride?: CanvasContextType) => {
  const isMobile = useIsMobile();
  const canvasContextFromHook = useCanvasContext();
  const canvasContext = canvasContextOverride ?? canvasContextFromHook;
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const clickStartPosRef = useRef<{x: number, y: number, pointerId?: number} | null>(null);
  const wasSelectedRef = useRef(false);
  const lastClickTimeRef = useRef(0);

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

    const state = useStore.getState();
    const button = e.button;
    const isMultiSelect = e.ctrlKey || e.shiftKey;

    if (button === 0) {
      if (state.contextMenu && state.contextMenu.blockId !== id) {
        state.closeContextMenu();
      }
      e.stopPropagation();
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      let shouldDrag: boolean;
      if (isMultiSelect) {
        state.selectBlock(id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          state.selectBlock(id, false);
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
      if (isClick) {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          if (!e.ctrlKey && !e.shiftKey) {
            useStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, blockId: id });
          }
          lastClickTimeRef.current = 0;
        } else {
          lastClickTimeRef.current = now;
        }
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    let hasPaused = false;
    const mainState = useStore.getState();
    const selectedIds = mainState.selectedBlockIds;

    const sourceBlocks =
      canvasContext === 'editor'
        ? useLevelEditorStore.getState().gameBlocks.filter(b => selectedIds.includes(b.id))
        : canvasContext === 'game'
          ? useGameStore.getState().gameBlocks.filter(b => selectedIds.includes(b.id))
          : mainState.blocks.filter(b => selectedIds.includes(b.id));

    if (!sourceBlocks.find(b => b.id === id)) {
      const thisBlock =
        canvasContext === 'editor'
          ? useLevelEditorStore.getState().gameBlocks.find(b => b.id === id)
          : canvasContext === 'game'
            ? useGameStore.getState().gameBlocks.find(b => b.id === id)
            : mainState.blocks.find(b => b.id === id);
      if (thisBlock) sourceBlocks.push(thisBlock);
    }

    const selectedTracks = mainState.tracks.filter(t => mainState.selectedTrackIds.includes(t.id));
    const selectedGroupRects = mainState.groupRects.filter(g => mainState.selectedGroupRectIds.includes(g.id));

    const initialPositions = new Map(sourceBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({ ...n }))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const applyUpdates = (updates: { id: string; updates: { x: number; y: number } }[]) => {
      if (canvasContext === 'editor') {
        useLevelEditorStore.getState().updateGameBlocks(updates);
      } else if (canvasContext === 'game') {
        useGameStore.getState().updateGameBlocks(updates);
      } else {
        useStore.getState().updateBlocks(updates);
      }
    };

    const handleGlobalMove = (e: PointerEvent) => {
      if (clickStartPosRef.current && clickStartPosRef.current.pointerId !== undefined && e.pointerId !== clickStartPosRef.current.pointerId) {
        return;
      }
      if (isMobile && (window as { __activeTouches?: number }).__activeTouches && (window as { __activeTouches?: number }).__activeTouches! > 1) {
        setIsDragging(false);
        if (hasPaused && canvasContext === 'playground') useStore.temporal.getState().resume();
        useStore.getState().clearSelection();
        return;
      }

      const state = useStore.getState();
      const camera = canvasContext === 'game' ? useGameStore.getState().gameCamera : state.camera;
      const { snapToGrid } = useSettingsStore.getState();

      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - rect.top - camera.y) / camera.zoom;

      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;

      if (snapToGrid) {
        const snapSize = 30;
        newX = Math.round(newX / snapSize) * snapSize;
        newY = Math.round(newY / snapSize) * snapSize;
      }

      const thisInit = initialPositions.get(id);
      if (!thisInit) return;

      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;

      const finalUpdates = sourceBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
      });

      if (canvasContext === 'playground') {
        if (!hasPaused) {
          useStore.temporal.setState(s => ({
            pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks }],
            futureStates: []
          }));
          useStore.temporal.getState().pause();
          hasPaused = true;
        }
      }

      applyUpdates(finalUpdates);

      const trackUpdates = selectedTracks.map(t => {
        const initNodes = initialTrackNodes.get(t.id)!;
        return { id: t.id, nodes: initNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) };
      });
      trackUpdates.forEach(tu => state.updateTrack(tu.id, { nodes: tu.nodes }));
      selectedGroupRects.forEach(g => {
        const init = initialGroupRects.get(g.id)!;
        state.updateGroupRect(g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
      if (canvasContext === 'playground' && hasPaused) {
        useStore.temporal.getState().resume();
      } else if (canvasContext === 'editor') {
        useLevelEditorStore.getState().commitHistory();
      }
      if (isMobile) {
        useStore.getState().clearSelection();
      }
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
