import React, { useCallback, useState } from 'react';
import '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store/useStore';
import { playNote } from '../utils/audio';
import { getPitchColorNumber } from '../utils/colors';

interface NoteBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
}

export const NoteBlock: React.FC<NoteBlockProps> = ({ id, x, y, pitch }) => {
  const { selectedBlockIds, selectBlock } = useStore();
  const blockOpacity = useStore(state => state.blockOpacity);
  const isSelected = selectedBlockIds.includes(id);

  const block = useStore(state => state.blocks.find(b => b.id === id));
  const volume = block?.volume ?? 1;
  const instrument = block?.instrument ?? 'piano';

  const showBlockPitch = useStore(state => state.showBlockPitch);
  const showBlockVolume = useStore(state => state.showBlockVolume);
  const showBlockInstrument = useStore(state => state.showBlockInstrument);

  const playedVolumeMultiplier = block?.playedVolumeMultiplier ?? 1;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const clickStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const wasSelectedRef = React.useRef(false);

  const graphicsRef = React.useRef<PIXI.Graphics>(null);
  const ripplesRef = React.useRef<{id: number, progress: number}[]>([]);

  const pianoKeysCount = useStore(state => state.pianoKeysCount);
  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);

  const playedAt = useStore(state => state.blocks.find(b => b.id === id)?.playedAt);
  const lastPlayedRef = React.useRef(playedAt && Date.now() - playedAt > 2000 ? playedAt : 0);

  React.useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      lastPlayedRef.current = playedAt;
      ripplesRef.current.push({ id: playedAt, progress: 0 });
      
      playNote(pitch, volume * playedVolumeMultiplier, instrument);
    }
  }, [playedAt, pitch, volume, instrument, playedVolumeMultiplier]);

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

      // Draw volume bar
      if (showBlockVolume) {
        g.roundRect(4, 50, 52, 6, 3);
        g.fill({ color: 0x000000, alpha: 0.3 });
        g.roundRect(4, 50, 52 * volume, 6, 3);
        g.fill({ color: 0xffffff, alpha: 0.8 });
      }
    },
    [isSelected, blockColor, blockOpacity, showBlockVolume, volume]
  );

  const handlePointerDown = (e: any) => {
    const button = e.button; 
    const isMultiSelect = e.ctrlKey || e.shiftKey;
    
    if (button === 0) {
      const state = useStore.getState();
      if (state.contextMenu && state.contextMenu.blockId !== id) {
        state.closeContextMenu();
      }
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
    } else if (button === 2) {
      // Handled by Canvas via event bubbling and target checking
    }
    // We let button === 2 (right click) bubble to Canvas to handle trail playing
  };

  const handlePointerUp = (e: any) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      if (Math.sqrt(dx*dx + dy*dy) < 5) {
        if (wasSelectedRef.current && !e.ctrlKey && !e.shiftKey) {
          useStore.getState().toggleContextMenu({
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
    if (!selectedBlocks.find(b => b.id === id)) {
      const thisBlock = state.blocks.find(b => b.id === id);
      if (thisBlock) selectedBlocks.push(thisBlock);
    }
    const selectedTracks = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
    const selectedGroupRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
    
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
      
      const thisInit = initialPositions.get(id);
      if (!thisInit) return;
      
      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;
      
      const currentBlock = state.blocks.find(sb => sb.id === id);
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

  // Determine instrument icon
  let instrumentIcon = '🎵';
  if (instrument === 'piano') instrumentIcon = '🎹';
  else if (instrument === 'synth') instrumentIcon = '📻';
  else if (instrument === 'bass') instrumentIcon = '🎸';
  else if (instrument === 'percussion') instrumentIcon = '🥁';

  return (
    <pixiContainer
      label="note-block"
      x={x}
      y={y}
      eventMode="static"
      cursor="pointer"
      hitArea={new PIXI.Rectangle(0, 0, 60, 60)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => useStore.getState().setHoveredBlockId(id)}
      onPointerLeave={() => {
        const state = useStore.getState();
        if (state.hoveredBlockId === id) {
          state.setHoveredBlockId(null);
        }
      }}
    >
      <pixiGraphics
        ref={graphicsRef}
        draw={draw}
      />
      {showBlockPitch && (
        // @ts-ignore
        <pixiText text={pitch} x={30} y={30} anchor={0.5} style={{ fontSize: 32, fill: '#ffffff', fontWeight: 'bold', fontFamily: 'Inter' }} scale={0.5} />
      )}
      {showBlockInstrument && (
        // @ts-ignore
        <pixiText text={instrumentIcon} x={42} y={4} style={{ fontSize: 24 }} scale={0.5} />
      )}
    </pixiContainer>
  );
};
