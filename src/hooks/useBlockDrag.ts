import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useIsMobile } from './useIsMobile';

export const useBlockDrag = (id: string, x: number, y: number, isSelected: boolean) => {
  const isMobile = useIsMobile();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const clickStartPosRef = useRef<{x: number, y: number, pointerId?: number} | null>(null);
  const wasSelectedRef = useRef(false);
  const lastClickTimeRef = useRef(0);

  const handlePointerDown = (e: any) => {
    const state = useStore.getState();
    if (state.gameState === 'play') return;
    const button = e.button; 
    const isMultiSelect = e.ctrlKey || e.shiftKey;
    
    if (button === 0) {
      if (state.contextMenu && state.contextMenu.blockId !== id) {
        state.closeContextMenu();
      }
      e.stopPropagation(); // prevent canvas from handling left click box selection
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      let shouldDrag = false;
      if (isMultiSelect) {
        state.selectBlock(id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          state.selectBlock(id, false);
        }
        // Allow drag even if already selected (deselect/solo handled on pointerUp if no drag)
        shouldDrag = true;
      }
      
      if (shouldDrag) {
        setIsDragging(true);
        const pos = e.currentTarget.parent.toLocal(e.global);
        setDragOffset({ x: pos.x - x, y: pos.y - y });
      }
    } else if (button === 2) {
      // Handled by Canvas via event bubbling and target checking
    }
  };

  const handlePointerUp = (e: any) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      const isClick = Math.sqrt(dx*dx + dy*dy) < 5;
      if (isClick) {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          // Double-click → open context menu
          if (!e.ctrlKey && !e.shiftKey) {
            useStore.getState().openContextMenu({
              x: e.clientX, y: e.clientY, blockId: id
            });
          }
          lastClickTimeRef.current = 0;
        } else {
          lastClickTimeRef.current = now;
          // Single click: no deselect behaviour
        }
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    let hasPaused = false;
    const state = useStore.getState();
    const selectedBlocks = [
      ...state.blocks.filter(b => state.selectedBlockIds.includes(b.id)),
      ...state.gameBlocks.filter(b => state.selectedBlockIds.includes(b.id))
    ];
    if (!selectedBlocks.find(b => b.id === id)) {
      const thisBlock = state.blocks.find(b => b.id === id) || state.gameBlocks.find(b => b.id === id);
      if (thisBlock) selectedBlocks.push(thisBlock);
    }
    const selectedTracks = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
    const selectedGroupRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
    
    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({...n}))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const handleGlobalMove = (e: PointerEvent) => {
      if (clickStartPosRef.current && clickStartPosRef.current.pointerId !== undefined && e.pointerId !== clickStartPosRef.current.pointerId) {
        return;
      }
      if (isMobile && (window as any).__activeTouches > 1) {
        setIsDragging(false);
        if (hasPaused) useStore.temporal.getState().resume();
        useStore.getState().clearSelection();
        return;
      }
      const state = useStore.getState();
      const camera = state.camera;
      
      let canvas = document.querySelector('.le-blocks-container canvas');
      if (!canvas) canvas = document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - rect.top - camera.y) / camera.zoom;
      
      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;
      
      if (state.snapToGrid) {
        const snapSize = 30;
        newX = Math.round(newX / snapSize) * snapSize;
        newY = Math.round(newY / snapSize) * snapSize;
      }
      
      const thisInit = initialPositions.get(id);
      if (!thisInit) return;
      
      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;
      
      const currentBlock = state.blocks.find(sb => sb.id === id) || state.gameBlocks.find(sb => sb.id === id);
      if (currentBlock && (thisInit.x + deltaX) === currentBlock.x && (thisInit.y + deltaY) === currentBlock.y) {
        return;
      }
      
      const finalUpdates = selectedBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
      });
      
      const trackUpdates = selectedTracks.map(t => {
        const initNodes = initialTrackNodes.get(t.id)!;
        const newNodes = initNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY }));
        return { id: t.id, nodes: newNodes };
      });

      if (!hasPaused) {
        useStore.temporal.setState(s => ({
          pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks, gameBlocks: state.gameBlocks }],
          futureStates: []
        }));
        useStore.temporal.getState().pause();
        hasPaused = true;
      }

      state.updateBlocks(finalUpdates);
      trackUpdates.forEach(tu => {
        state.updateTrack(tu.id, { nodes: tu.nodes });
      });
      selectedGroupRects.forEach(g => {
        const init = initialGroupRects.get(g.id)!;
        state.updateGroupRect(g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
      if (hasPaused) {
        useStore.temporal.getState().resume();
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
  }, [isDragging, dragOffset, id, isMobile]);

  return { handlePointerDown, handlePointerUp, isDragging };
};
