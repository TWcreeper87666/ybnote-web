import React, { useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store/useStore';

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

  const showBlockVolume = useStore(state => state.showBlockVolume);
  const showGroupName = useStore(state => state.showGroupName);


  const ripplesRef = React.useRef<{id: number, progress: number}[]>([]);
  const lastPlayedRef = React.useRef(rect.playedAt);
  const graphicsRef = React.useRef<PIXI.Graphics>(null);

  React.useEffect(() => {
    if (rect.playedAt && rect.playedAt !== lastPlayedRef.current) {
      lastPlayedRef.current = rect.playedAt;
      ripplesRef.current.push({ id: rect.playedAt, progress: 0 });
    }
  }, [rect.playedAt]);

  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();

    // Draw ripples (particles)
    ripplesRef.current.forEach(r => {
      const expansion = r.progress * 40; 
      const alpha = 1 - r.progress; 
      g.roundRect(rect.x - expansion, rect.y - expansion, rect.w + expansion * 2, rect.h + expansion * 2, 8);
      g.stroke({ width: 4, color: 0x8b5cf6, alpha: alpha });
    });

      // Selected outline glow
      if (isSelected) {
        g.roundRect(rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, 10);
        g.fill({ color: 0x6366f1, alpha: 0.3 }); // Indigo glow
        g.stroke({ width: 3, color: 0x4f46e5, alpha: 0.8 });
      } else {
        // Default border
        g.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.2 });
      }

      g.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
      g.fill({ color: 0xffffff, alpha: 0.05 });

      if (showBlockVolume) {
        const barW = Math.max(52, Math.min(100, rect.w - 16));
        const currentVol = rect.volume ?? 1;
        const volAlpha = isSelected ? 1 : 0.5;
        if (barW > 0) {
          g.roundRect(rect.x + 8, rect.y + rect.h - 14, barW, 6, 3);
          g.fill({ color: 0x000000, alpha: 0.3 * volAlpha });
          g.roundRect(rect.x + 8, rect.y + rect.h - 14, barW * currentVol, 6, 3);
          g.fill({ color: 0xffffff, alpha: 0.8 * volAlpha });
        }
      }
    },
    [rect.x, rect.y, rect.w, rect.h, isSelected, rect.volume, showBlockVolume]
  );

  // Animation loop for ripples
  React.useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const tick = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      
      if (ripplesRef.current.length > 0) {
        ripplesRef.current.forEach(r => r.progress += delta * 2.0);
        ripplesRef.current = ripplesRef.current.filter(r => r.progress < 1);
        if (graphicsRef.current) {
          draw(graphicsRef.current);
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };
    
    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw]);

  React.useEffect(() => {
    if (graphicsRef.current) {
      graphicsRef.current.hitArea = new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h);
    }
  }, [rect.x, rect.y, rect.w, rect.h]);

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
          pastStates: [...s.pastStates, { groupRects: state.groupRects }],
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
          pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks }],
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
      if (Math.hypot(dx, dy) < 5) {
        if (wasSelectedRef.current && !e.ctrlKey && !e.shiftKey) {
          useStore.getState().toggleContextMenu({
            x: e.clientX, y: e.clientY, blockId: `groupRect:${rect.id}`
          });
        }
      }
    }
  };

  const handleDrawHandle = useCallback((g: PIXI.Graphics, w: number, h: number) => {
    g.clear();
    g.rect(0, 0, w, h);
    g.fill({ color: 0x000000, alpha: 0.001 }); // invisible but interactive
  }, []);

  const m = 16; // Hit area thickness for resizing
  const handles = [
    // Edges
    { type: 'n', x: rect.x, y: rect.y - m/2, w: rect.w, h: m, cursor: 'ns-resize' },
    { type: 's', x: rect.x, y: rect.y + rect.h - m/2, w: rect.w, h: m, cursor: 'ns-resize' },
    { type: 'w', x: rect.x - m/2, y: rect.y, w: m, h: rect.h, cursor: 'ew-resize' },
    { type: 'e', x: rect.x + rect.w - m/2, y: rect.y, w: m, h: rect.h, cursor: 'ew-resize' },
    // Corners (rendered last so they take priority in corners)
    { type: 'nw', x: rect.x - m/2, y: rect.y - m/2, w: m, h: m, cursor: 'nwse-resize' },
    { type: 'ne', x: rect.x + rect.w - m/2, y: rect.y - m/2, w: m, h: m, cursor: 'nesw-resize' },
    { type: 'sw', x: rect.x - m/2, y: rect.y + rect.h - m/2, w: m, h: m, cursor: 'nesw-resize' },
    { type: 'se', x: rect.x + rect.w - m/2, y: rect.y + rect.h - m/2, w: m, h: m, cursor: 'nwse-resize' },
  ];

  return (
    <pixiContainer>
      <pixiGraphics
        ref={graphicsRef}
        draw={draw}
        eventMode="static"
        cursor="pointer"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerEnter={() => useStore.getState().setHoveredGroupRectId(rect.id)}
        onPointerLeave={() => {
          const state = useStore.getState();
          if (state.hoveredGroupRectId === rect.id) {
            state.setHoveredGroupRectId(null);
          }
        }}
      />
      {isSelected && handles.map(h => (
        <pixiGraphics
          key={h.type}
          x={h.x}
          y={h.y}
          draw={(g) => handleDrawHandle(g, h.w, h.h)}
          eventMode="static"
          cursor={h.cursor}
          onPointerDown={(e: PIXI.FederatedPointerEvent) => handleResizeDown(h.type, e)}
        />
      ))}
      {showGroupName && (
        // @ts-ignore
        <pixiText text={`${rect.name || ''}`} x={rect.x + 8} y={rect.y + 8} style={{ fontSize: 32, fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Inter' }} alpha={isSelected ? 1 : 0.5} scale={0.5} eventMode="none" />
      )}
      {/* Invisible larger hit area for easier grabbing if it's mostly empty inside? 
          The rectangle itself is filled with alpha 0.15, so it should catch events. */}
    </pixiContainer>
  );
};
