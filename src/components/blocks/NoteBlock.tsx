import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { BaseBlock } from './BaseBlock';
import { DrumBlock } from './DrumBlock';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { getPitchColorNumber } from '../../utils/colors';

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

  const block = useStore(state => state.blocks.find(b => b.id === id) || state.gameBlocks.find(b => b.id === id));
  const volume = block?.volume ?? 1;
  const instrument = block?.instrument ?? 'piano';
  const playedAt = block?.playedAt;

  const showBlockPitch = useStore(state => state.showBlockPitch);
  const showBlockVolume = useStore(state => state.showBlockVolume);
  const showBlockInstrument = useStore(state => state.showBlockInstrument);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const clickStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const wasSelectedRef = React.useRef(false);
  const lastClickTimeRef = React.useRef(0);

  const pianoKeysCount = useStore(state => state.pianoKeysCount);
  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);

  const playedVolumeMultiplier = block?.playedVolumeMultiplier ?? 1;
  const lastPlayedRef = React.useRef(playedAt && Date.now() - playedAt > 2000 ? playedAt : 0);

  React.useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      lastPlayedRef.current = playedAt;
      
      const isLevelEditorPlaying = window.location.href.includes('editor') && 
        (() => {
           try {
             const state = (window as any).levelEditorStore.getState();
             return state.isPlaying;
           } catch (e) {
             return false;
           }
        })();

      if (!isLevelEditorPlaying) {
          import('../../utils/audio').then(({ playNote }) => {
              playNote(pitch, volume * playedVolumeMultiplier, instrument);
              if (useStore.getState().mode === 'play') {
                 useStore.getState().setLatestPerformHit({ time: Date.now(), color: blockColor });
              }
          });
      }
    }
  }, [playedAt, pitch, volume, instrument, playedVolumeMultiplier, blockColor]);

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

  React.useEffect(() => {
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
  }, [isDragging, dragOffset, id]);

  const handlePointerEnter = () => useStore.getState().setHoveredBlockId(id);
  const handlePointerLeave = () => {
    const state = useStore.getState();
    if (state.hoveredBlockId === id) {
      state.setHoveredBlockId(null);
    }
  };

  const BlockComponent = instrument === 'percussion' ? DrumBlock : BaseBlock;

  const isEditor = window.location.href.includes('editor');
  const midiData = useLevelEditorStore((s) => isEditor ? s.midiData : null);

  const isInvalid = React.useMemo(() => {
    if (!isEditor || !midiData) return false;
    for (const track of midiData.tracks) {
      if (track.instrument === instrument) {
        if (track.notes.some(n => n.name === pitch)) return false;
      }
    }
    return true;
  }, [pitch, instrument, midiData, isEditor]);

  return (
    <BlockComponent
      id={id}
      x={x}
      y={y}
      pitch={pitch}
      instrument={instrument}
      volume={volume}
      blockColor={blockColor}
      opacity={blockOpacity}
      isSelected={isSelected}
      showPitch={showBlockPitch}
      showInstrument={showBlockInstrument}
      showVolume={showBlockVolume}
      playedAt={playedAt}
      isInteractive={true}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      isInvalid={isInvalid}
    />
  );
};
