import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { BaseGroupRect } from './BaseGroupRect';

export const GroupRectRenderer: React.FC = () => {
  const groupRects = useStore(state => state.groupRects);
  return (
    <>
      {groupRects.map(rect => (
        <GroupRectItem key={rect.id} rect={rect} />
      ))}
    </>
  );
};

const GroupRectItem: React.FC<{ rect: any }> = ({ rect }) => {
  const { selectGroupRect, selectedGroupRectIds } = useStore();
  const isSelected = selectedGroupRectIds.includes(rect.id);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<string | null>(null);

  const resizeStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const initialRectRef = React.useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const clickStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const wasSelectedRef = React.useRef(false);
  const lastClickTimeRef = React.useRef(0);

  const showBlockVolume = useStore(state => state.showBlockVolume);
  const showGroupName = useStore(state => state.showGroupName);




  const handleResizeDown = (type: string, e: any) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeType(type);
    const camera = useStore.getState().camera;
    const localX = (e.clientX - camera.x) / camera.zoom;
    const localY = (e.clientY - camera.y) / camera.zoom;
    resizeStartPosRef.current = { x: localX, y: localY };
    initialRectRef.current = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  };

  React.useEffect(() => {
    if (!isResizing || !resizeType || !initialRectRef.current || !resizeStartPosRef.current) return;

    let hasPaused = false;
    const handleGlobalMove = (e: PointerEvent) => {
      const state = useStore.getState();
      const camera = state.camera;
      
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;
      
      const initRect = initialRectRef.current!;
      const startPos = resizeStartPosRef.current!;
      
      const deltaX = localX - startPos.x;
      const deltaY = localY - startPos.y;
      
      let newX = initRect.x;
      let newY = initRect.y;
      let newW = initRect.w;
      let newH = initRect.h;

      if (resizeType.includes('w')) {
        newX = initRect.x + deltaX;
        newW = initRect.w - deltaX;
      }
      if (resizeType.includes('e')) {
        newW = initRect.w + deltaX;
      }
      if (resizeType.includes('n')) {
        newY = initRect.y + deltaY;
        newH = initRect.h - deltaY;
      }
      if (resizeType.includes('s')) {
        newH = initRect.h + deltaY;
      }

      if (state.snapToGrid) {
        const snapSize = 30;
        if (resizeType.includes('w')) {
          const snappedX = Math.round(newX / snapSize) * snapSize;
          newW = newW + (newX - snappedX);
          newX = snappedX;
        }
        if (resizeType.includes('e')) {
          const snappedRight = Math.round((newX + newW) / snapSize) * snapSize;
          newW = snappedRight - newX;
        }
        if (resizeType.includes('n')) {
          const snappedY = Math.round(newY / snapSize) * snapSize;
          newH = newH + (newY - snappedY);
          newY = snappedY;
        }
        if (resizeType.includes('s')) {
          const snappedBottom = Math.round((newY + newH) / snapSize) * snapSize;
          newH = snappedBottom - newY;
        }
      }

      const MIN_SIZE = 20;
      if (newW < MIN_SIZE) {
        if (resizeType.includes('w')) newX = initRect.x + initRect.w - MIN_SIZE;
        newW = MIN_SIZE;
      }
      if (newH < MIN_SIZE) {
        if (resizeType.includes('n')) newY = initRect.y + initRect.h - MIN_SIZE;
        newH = MIN_SIZE;
      }

      if (!hasPaused) {
        useStore.temporal.setState(s => ({
          pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks, gameBlocks: state.gameBlocks }],
          futureStates: []
        }));
        useStore.temporal.getState().pause();
        hasPaused = true;
      }

      state.updateGroupRect(rect.id, { x: newX, y: newY, w: newW, h: newH });
    };

    const handleGlobalUp = () => {
      setIsResizing(false);
      setResizeType(null);
      if (hasPaused) {
        useStore.temporal.getState().resume();
      }
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [isResizing, resizeType, rect.id]);

  const handlePointerDown = (e: any) => {
    const button = e.button; 
    const isMultiSelect = e.ctrlKey || e.shiftKey;
    
    if (button === 0) { // Left click
      const state = useStore.getState();
      if (state.contextMenu && state.contextMenu.blockId !== `groupRect:${rect.id}`) {
        state.closeContextMenu();
      }
      e.stopPropagation();
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY };

      let shouldDrag = false;
      if (isMultiSelect) {
        selectGroupRect(rect.id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          selectGroupRect(rect.id, false);
        }
        // Allow drag even if already selected (deselect/solo handled on pointerUp if no drag)
        shouldDrag = true;
      }

      if (shouldDrag) {
        setIsDragging(true);
        const pos = e.currentTarget.parent.toLocal(e.global);
        setDragOffset({ x: pos.x - rect.x, y: pos.y - rect.y });
      }
    }
  };

  React.useEffect(() => {
    if (!isDragging) return;

    let hasPaused = false;
    const state = useStore.getState();
    const selectedBlocks = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
    const selectedTracks = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
    const selectedGroupRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
    if (!selectedGroupRects.find(g => g.id === rect.id)) {
      const thisRect = state.groupRects.find(g => g.id === rect.id);
      if (thisRect) selectedGroupRects.push(thisRect);
    }
    
    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({...n}))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const handleGlobalMove = (e: PointerEvent) => {
      const state = useStore.getState();
      const camera = state.camera;
      
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;
      
      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;
      
      if (state.snapToGrid) {
        const snapSize = 30;
        newX = Math.round(newX / snapSize) * snapSize;
        newY = Math.round(newY / snapSize) * snapSize;
      }
      
      const thisInit = initialGroupRects.get(rect.id);
      if (!thisInit) return;
      
      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;
      
      const currentGroupRect = state.groupRects.find(sg => sg.id === rect.id);
      if (currentGroupRect && (thisInit.x + deltaX) === currentGroupRect.x && (thisInit.y + deltaY) === currentGroupRect.y) {
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
  }, [isDragging, dragOffset, rect.id]);

  const handlePointerUp = (e: any) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      const isClick = Math.hypot(dx, dy) < 5;
      if (isClick) {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          if (!e.ctrlKey && !e.shiftKey) {
            useStore.getState().openContextMenu({
              x: e.clientX, y: e.clientY, blockId: `groupRect:${rect.id}`
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

  const handlePointerEnter = () => useStore.getState().setHoveredGroupRectId(rect.id);
  const handlePointerLeave = () => {
    const state = useStore.getState();
    if (state.hoveredGroupRectId === rect.id) {
      state.setHoveredGroupRectId(null);
    }
  };

  return (
    <BaseGroupRect
      id={rect.id}
      x={rect.x}
      y={rect.y}
      w={rect.w}
      h={rect.h}
      name={rect.name}
      volume={rect.volume}
      isSelected={isSelected}
      showVolume={showBlockVolume}
      showGroupName={showGroupName}
      playedAt={rect.playedAt}
      enabled={rect.enabled}
      isInteractive={true}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onResizeDown={handleResizeDown}
    />
  );
};
