import React, { useCallback, useState } from 'react';
import '@pixi/react';
import * as PIXI from 'pixi.js';
import { playNote } from '../utils/audio';
import { useStore } from '../store/useStore';
import { getPitchColorNumber } from '../utils/colors';

interface NoteBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
}

export const NoteBlock: React.FC<NoteBlockProps> = ({ id, x, y, pitch }) => {
  const { selectedBlockIds, selectBlock } = useStore();
  const snapToGrid = useStore(state => state.snapToGrid);
  const blockOpacity = useStore(state => state.blockOpacity);
  const isSelected = selectedBlockIds.includes(id);
  const isMultiSelect = selectedBlockIds.length > 1;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const clickStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const wasSelectedRef = React.useRef(false);

  const graphicsRef = React.useRef<PIXI.Graphics>(null);
  const ripplesRef = React.useRef<{id: number, progress: number}[]>([]);

  const pianoKeysCount = useStore(state => state.pianoKeysCount);
  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);

  const playedAt = useStore(state => state.blocks.find(b => b.id === id)?.playedAt);
  const lastPlayedRef = React.useRef(playedAt);

  React.useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      lastPlayedRef.current = playedAt;
      ripplesRef.current.push({ id: playedAt, progress: 0 });
    }
  }, [playedAt]);

  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      
      // Draw ripples
      ripplesRef.current.forEach(r => {
        const size = 60 + r.progress * 40; 
        const alpha = 1 - r.progress; 
        const offset = (size - 60) / 2;
        g.roundRect(-offset, -offset, size, size, 8);
        g.stroke({ width: 3, color: blockColor, alpha: alpha });
      });
      
      // Selected outline glow
      if (isSelected) {
        g.roundRect(-4, -4, 68, 68, 10);
        g.fill({ color: 0x6366f1, alpha: 0.5 }); // Indigo glow
      }

      g.roundRect(0, 0, 60, 60, 8); // Square block
      g.fill({ color: blockColor, alpha: blockOpacity });
      g.stroke({ width: isSelected ? 3 : 2, color: isSelected ? 0x4f46e5 : 0xffffff, alpha: isSelected ? 1 : 0.4 });
    },
    [isSelected, blockColor, blockOpacity]
  );

  const handlePointerDown = (e: any) => {
    const button = e.button; 
    const isMultiSelect = e.ctrlKey || e.shiftKey;
    
    if (button === 0) {
      e.stopPropagation(); // prevent canvas from handling left click box selection
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY };
      let shouldDrag = false;
      if (isMultiSelect) {
        selectBlock(id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          selectBlock(id, false);
        }
        shouldDrag = true;
      }
      
      if (shouldDrag) {
        setIsDragging(true);
        const pos = e.currentTarget.parent.toLocal(e.global);
        setDragOffset({ x: pos.x - x, y: pos.y - y });
      }
    }
    // We let button === 2 (right click) bubble to Canvas to handle trail playing
  };

  const handlePointerUp = (e: any) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      if (Math.sqrt(dx*dx + dy*dy) < 5) {
        if (wasSelectedRef.current) {
          useStore.getState().openContextMenu({
            x: e.clientX, y: e.clientY, blockId: id
          });
        }
      }
    }
  };

  React.useEffect(() => {
    if (!isDragging) return;

    let hasPaused = false;
    const state = useStore.getState();
    const selectedBlocks = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
    // Provide a fallback if this block isn't in selectedBlockIds (though it should be)
    if (!selectedBlocks.find(b => b.id === id)) {
      const thisBlock = state.blocks.find(b => b.id === id);
      if (thisBlock) selectedBlocks.push(thisBlock);
    }
    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));

    const handleGlobalMove = (e: PointerEvent) => {
      const state = useStore.getState();
      const camera = state.camera;
      
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;
      
      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;
      
      if (state.snapToGrid) {
        const gridSize = 60;
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }
      
      const thisInit = initialPositions.get(id);
      if (!thisInit) return;
      
      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;
      
      let actuallyMoved = false;
      const finalUpdates = selectedBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        const targetX = init.x + deltaX;
        const targetY = init.y + deltaY;
        if (targetX !== init.x || targetY !== init.y) {
          actuallyMoved = true;
        }
        return { id: b.id, updates: { x: targetX, y: targetY } };
      });

      if (!actuallyMoved) return;

      if (!hasPaused) {
        useStore.temporal.setState(s => ({
          pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups }],
          futureStates: []
        }));
        useStore.temporal.getState().pause();
        hasPaused = true;
      }

      state.updateBlocks(finalUpdates);
    };

    const handleGlobalUp = (e: PointerEvent) => {
      setIsDragging(false);
      clickStartPosRef.current = null;
      if (hasPaused) {
        useStore.temporal.getState().resume();
      }
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    // Also cancel on contextmenu just in case it fires
    window.addEventListener('contextmenu', handleGlobalUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      window.removeEventListener('contextmenu', handleGlobalUp);
    };
  }, [isDragging, dragOffset, id]);

  // Handle pointer enter is removed, intersection logic is moved to Canvas

  // Add animation loop for ripples
  React.useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const tick = (time: number) => {
      const delta = (time - lastTime) / 1000; // in seconds
      lastTime = time;
      
      if (ripplesRef.current.length > 0) {
        ripplesRef.current.forEach(r => r.progress += delta * 2.5); // expand speed
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

  return (
    <pixiGraphics
      ref={graphicsRef}
      x={x}
      y={y}
      draw={draw}
      eventMode="static"
      cursor="pointer"
      hitArea={new PIXI.Rectangle(0, 0, 60, 60)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    />
  );
};
