import React from 'react';
import { useStore } from '../../store/useStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { useGameStore } from '../../store/useGameStore';
import { useCanvasContext } from '../canvas/CanvasContext';
import { useActiveCanvasSelectedBlockIds } from '../../hooks/useActiveCanvas';
import { shiftPitch } from '../../utils/pitchUtils';
import {
  Trash2, Search, Activity, Square, Music, Play, Pause,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter
} from 'lucide-react';
export const ContextMenu: React.FC = () => {
  const canvasContext = useCanvasContext();
  const { blocks, groupRects, trackPlaybackStatus, playTrack, pauseTrack, stopTrack, isPlaying } = useStore();

  // Context-aware contextMenu: each store has its own contextMenu state
  const playgroundContextMenu = useStore(s => s.contextMenu);
  const editorContextMenu = useLevelEditorStore(s => s.contextMenu);
  const gameContextMenu = useGameStore(s => s.contextMenu);
  const contextMenu = canvasContext === 'editor' ? editorContextMenu
    : canvasContext === 'game' ? gameContextMenu
    : playgroundContextMenu;

  const closeContextMenu = () => {
    if (canvasContext === 'editor') useLevelEditorStore.getState().closeContextMenu();
    else if (canvasContext === 'game') useGameStore.getState().closeContextMenu();
    else useStore.getState().closeContextMenu();
  };

  // Context-aware store mutations
  const getContextSt = () => {
    if (canvasContext === 'editor') return useLevelEditorStore.getState();
    if (canvasContext === 'game') return useGameStore.getState();
    return useStore.getState();
  };

  const selectedBlockIds = useActiveCanvasSelectedBlockIds();

  const editorBlocks = useLevelEditorStore(s => s.blocks);
  const editorGroupRects = useLevelEditorStore(s => s.groupRects);
  const editorTracks = useLevelEditorStore(s => s.tracks);
  const gameBlocks = useGameStore(s => s.blocks);
  const gameGroupRects = useGameStore(s => s.groupRects);
  const gameTracks = useGameStore(s => s.tracks);
  const { tracks: playgroundTracks } = useStore();

  const contextBlocks = canvasContext === 'editor' ? editorBlocks
    : canvasContext === 'game' ? gameBlocks
    : blocks;

  const contextGroupRects = canvasContext === 'editor' ? editorGroupRects
    : canvasContext === 'game' ? gameGroupRects
    : groupRects;

  const menuRef = React.useRef<HTMLDivElement>(null);
  const [measuredPos, setMeasuredPos] = React.useState<{x: number, y: number} | null>(null);
  const [prevContextMenu, setPrevContextMenu] = React.useState(contextMenu);

  if (prevContextMenu !== contextMenu) {
    setPrevContextMenu(contextMenu);
    setMeasuredPos(null);
  }

  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!measuredPos) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - measuredPos.x,
      y: e.clientY - measuredPos.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setMeasuredPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  React.useLayoutEffect(() => {
    if (contextMenu && menuRef.current && !measuredPos) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = contextMenu.x - (rect.width / 2);
      let newY = contextMenu.y + 5;

      if (newX < 0) {
        newX = 8;
      } else if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 8;
      }

      if (newY + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 8;
      }

      setMeasuredPos({ x: newX, y: newY });
    }
  }, [contextMenu, measuredPos]);

  React.useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalInteraction = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      closeContextMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    window.addEventListener('pointerdown', handleGlobalInteraction, { capture: true });
    window.addEventListener('wheel', handleGlobalInteraction, { capture: true });
    window.addEventListener('contextmenu', handleGlobalInteraction, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleGlobalInteraction, { capture: true });
      window.removeEventListener('wheel', handleGlobalInteraction, { capture: true });
      window.removeEventListener('contextmenu', handleGlobalInteraction, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const displayX = measuredPos ? measuredPos.x : contextMenu.x - 60;
  const displayY = measuredPos ? measuredPos.y : contextMenu.y + 5;
  const visibility = measuredPos ? 'visible' : 'hidden';

  const isGroupRect = contextMenu.blockId.startsWith('groupRect:');
  const isTrack = contextMenu.blockId.startsWith('track:');
  const actualId = isGroupRect ? contextMenu.blockId.split(':')[1] : (isTrack ? contextMenu.blockId.split(':')[1] : contextMenu.blockId);

  const contextTracks = canvasContext === 'editor' ? editorTracks
    : canvasContext === 'game' ? gameTracks
    : playgroundTracks;

  if (isTrack) {
    const track = contextTracks.find(t => t.id === actualId);
    if (!track) return null;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      getContextSt().deleteTrack(track.id);
      closeContextMenu();
    };

    return (
      <div 
        ref={menuRef}
        className="context-menu glass-panel"
        style={{
          position: 'fixed',
          left: displayX,
          top: displayY,
          visibility: visibility as 'visible' | 'hidden',
          zIndex: 1000,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '120px',
          pointerEvents: 'auto'
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', cursor: 'move', userSelect: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            <Activity size={14} /> Track
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#9ca3af', backgroundColor: 'transparent', borderRadius: '4px' }} 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeContextMenu();
                window.dispatchEvent(new CustomEvent('find-in-outliner', { detail: `track:${track.id}` }));
              }}
              title="Find in Outliner"
            >
              <Search size={14} />
            </button>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }} 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              title="Delete Track"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        {track.enabled !== false && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Playback</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {trackPlaybackStatus[track.id] === 'playing' || isPlaying ? (
              <button 
                className="icon-btn" 
                style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', display: 'flex', justifyContent: 'center', transition: 'all 0.2s' }} 
                onClick={(e) => { e.stopPropagation(); pauseTrack(track.id); }} 
                title="Pause"
              >
                <Pause size={16} fill="currentColor" />
              </button>
            ) : (
              <button 
                className="icon-btn" 
                style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', display: 'flex', justifyContent: 'center', transition: 'all 0.2s' }} 
                onClick={(e) => { e.stopPropagation(); playTrack(track.id); }} 
                title="Play"
              >
                <Play size={16} fill="currentColor" />
              </button>
            )}
            <button 
              className="icon-btn" 
              style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', transition: 'all 0.2s' }} 
              onClick={(e) => { e.stopPropagation(); stopTrack(track.id); }} 
              title="Stop"
            >
              <Square size={16} fill="currentColor" />
            </button>
          </div>
        </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Name</label>
          <input 
            type="text" 
            value={track.name || ''} 
            onChange={(e) => {
              getContextSt().updateTrack(track.id, { name: e.target.value });
            }}
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Speed (BPM)</label>
          <input 
            type="number" 
            value={track.bpm || 120} 
            onChange={(e) => {
              getContextSt().updateTrack(track.id, { bpm: Number(e.target.value) || 120 });
            }}
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Loop Mode</label>
          <select 
            value={track.loop === true ? 'circular' : track.loop === 'restart' ? 'restart' : 'none'} 
            onChange={(e) => {
              const val = e.target.value;
              let loopVal: boolean | 'restart' = false;
              if (val === 'circular') loopVal = true;
              if (val === 'restart') loopVal = 'restart';
              getContextSt().updateTrack(track.id, { loop: loopVal });
            }}
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px' }}
          >
            <option value="none">No Loop (Stop at end)</option>
            <option value="circular">Circular (Connect end to start)</option>
            <option value="restart">Restart (Jump to start)</option>
          </select>
        </div>

        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px', cursor: 'pointer' }}
          onClick={() => getContextSt().updateTrack(track.id, { enabled: track.enabled === false ? true : false })}
        >
          <span style={{ fontSize: '12px', opacity: 0.8, userSelect: 'none' }}>Enable Track</span>
          <div className={`switch-track ${track.enabled !== false ? 'active' : ''}`} style={{ zoom: 0.8 }}>
            <div className="switch-thumb" />
          </div>
        </div>
      </div>
    );
  }

  if (isGroupRect) {
    const rect = contextGroupRects.find(g => g.id === actualId);
    if (!rect) return null;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      getContextSt().removeGroupRect(rect.id);
      closeContextMenu();
    };

    return (
      <div 
        ref={menuRef}
        className="context-menu glass-panel"
        style={{
          position: 'fixed',
          left: displayX,
          top: displayY,
          visibility: visibility as 'visible' | 'hidden',
          zIndex: 1000,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '120px',
          pointerEvents: 'auto'
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', cursor: 'move', userSelect: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            <Square size={14} fill="currentColor" /> Group Area
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#9ca3af', backgroundColor: 'transparent', borderRadius: '4px' }} 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeContextMenu();
                window.dispatchEvent(new CustomEvent('find-in-outliner', { detail: `groupRect:${rect.id}` }));
              }}
              title="Find in Outliner"
            >
              <Search size={14} />
            </button>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }} 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              title="Delete Group"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Name</label>
          <input 
            type="text" 
            value={rect.name || ''} 
            onChange={(e) => {
              getContextSt().updateGroupRect(rect.id, { name: e.target.value });
            }}
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Volume: {Math.round((rect.volume ?? 1) * 100)}%</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={rect.volume ?? 1} 
            onChange={(e) => {
              const vol = parseFloat(e.target.value);
              getContextSt().updateGroupRect(rect.id, { volume: vol });
            }} 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Keybinding</label>
          <input 
            type="text" 
            maxLength={1}
            value={rect.keyBinding || ''} 
            onChange={() => {}}
            onKeyDown={(e) => {
              e.preventDefault();
              if (e.key === 'Backspace' || e.key === 'Delete') {
                getContextSt().updateGroupRect(rect.id, { keyBinding: '' });
              } else if (e.key.length === 1) {
                getContextSt().updateGroupRect(rect.id, { keyBinding: e.key.toLowerCase() });
              }
            }}
            placeholder="No Key"
            className="uppercase"
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px', textAlign: 'center', caretColor: 'transparent' }}
          />
        </div>

        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px', cursor: 'pointer' }}
          onClick={() => getContextSt().updateGroupRect(rect.id, { enabled: rect.enabled === false ? true : false })}
        >
          <span style={{ fontSize: '12px', opacity: 0.8, userSelect: 'none' }}>Enable Group</span>
          <div className={`switch-track ${rect.enabled !== false ? 'active' : ''}`} style={{ zoom: 0.8 }}>
            <div className="switch-thumb" />
          </div>
        </div>
      </div>
    );
  }

  const block = contextBlocks.find(b => b.id === actualId);
  if (!block) return null;

  const targetBlocks = selectedBlockIds.length > 0 && selectedBlockIds.includes(block.id)
    ? contextBlocks.filter(b => selectedBlockIds.includes(b.id))
    : [block];

  const tunePitch = (semitones: number) => {
    getContextSt().mutateBlocks(
      [block.id],
      (b) => ({ pitch: shiftPitch(b.pitch, semitones), playedAt: Date.now(), playedVolumeMultiplier: 1 })
    );
  };

  const handleTuneUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    tunePitch(1);
  };

  const handleTuneDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    tunePitch(-1);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetBlocks.length > 1) {
      getContextSt().deleteSelected();
    } else {
      getContextSt().removeBlock(block.id);
    }
    closeContextMenu();
  };

  const handleAlignLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    const minX = Math.min(...targetBlocks.map(b => b.x));
    getContextSt().mutateBlocks([block.id], () => ({ x: minX }));
  };

  const handleAlignCenterHorizontal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const minX = Math.min(...targetBlocks.map(b => b.x));
    const maxX = Math.max(...targetBlocks.map(b => b.x));
    const centerX = (minX + maxX) / 2;
    getContextSt().mutateBlocks([block.id], () => ({ x: centerX }));
  };

  const handleAlignRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    const maxX = Math.max(...targetBlocks.map(b => b.x));
    getContextSt().mutateBlocks([block.id], () => ({ x: maxX }));
  };

  const handleAlignTop = (e: React.MouseEvent) => {
    e.stopPropagation();
    const minY = Math.min(...targetBlocks.map(b => b.y));
    getContextSt().mutateBlocks([block.id], () => ({ y: minY }));
  };

  const handleAlignCenterVertical = (e: React.MouseEvent) => {
    e.stopPropagation();
    const minY = Math.min(...targetBlocks.map(b => b.y));
    const maxY = Math.max(...targetBlocks.map(b => b.y));
    const centerY = (minY + maxY) / 2;
    getContextSt().mutateBlocks([block.id], () => ({ y: centerY }));
  };

  const handleAlignBottom = (e: React.MouseEvent) => {
    e.stopPropagation();
    const maxY = Math.max(...targetBlocks.map(b => b.y));
    getContextSt().mutateBlocks([block.id], () => ({ y: maxY }));
  };

  const handleDistributeHorizontal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetBlocks.length < 2) return;
    const sorted = [...targetBlocks].sort((a, b) => a.x - b.x);
    const minX = sorted[0].x;
    const maxX = sorted[sorted.length - 1].x;
    const step = (maxX - minX) / (sorted.length - 1);
    
    const updates = sorted.map((b, i) => ({
      id: b.id,
      updates: { x: minX + step * i }
    }));
    getContextSt().updateBlocks(updates);
  };

  const handleDistributeVertical = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetBlocks.length < 2) return;
    const sorted = [...targetBlocks].sort((a, b) => a.y - b.y);
    const minY = sorted[0].y;
    const maxY = sorted[sorted.length - 1].y;
    const step = (maxY - minY) / (sorted.length - 1);
    
    const updates = sorted.map((b, i) => ({
      id: b.id,
      updates: { y: minY + step * i }
    }));
    getContextSt().updateBlocks(updates);
  };

  return (
    <div 
      ref={menuRef}
      className="context-menu glass-panel"
      style={{
        position: 'fixed',
        left: displayX,
        top: displayY,
        visibility: visibility as 'visible' | 'hidden',
        zIndex: 1000,
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '120px',
        pointerEvents: 'auto'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', cursor: 'move', userSelect: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            <Music size={14} /> {targetBlocks.length > 1 ? `${targetBlocks.length} Blocks` : `Block: ${block.pitch}`}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#9ca3af', backgroundColor: 'transparent', borderRadius: '4px' }} 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeContextMenu();
                window.dispatchEvent(new CustomEvent('find-in-outliner', { detail: block.id }));
              }}
              title="Find in Outliner"
            >
              <Search size={14} />
            </button>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }} 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleDelete}
              title={targetBlocks.length > 1 ? 'Delete Selected' : 'Delete Block'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

      {targetBlocks.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Align Selected</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleAlignLeft} title="Align Left">
              <AlignStartVertical size={16} />
            </button>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleAlignCenterHorizontal} title="Align Center (Horizontal)">
              <AlignCenterVertical size={16} />
            </button>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleAlignRight} title="Align Right">
              <AlignEndVertical size={16} />
            </button>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleDistributeHorizontal} title="Distribute Horizontally">
              <AlignHorizontalDistributeCenter size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleAlignTop} title="Align Top">
              <AlignStartHorizontal size={16} />
            </button>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleAlignCenterVertical} title="Align Center (Vertical)">
              <AlignCenterHorizontal size={16} />
            </button>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleAlignBottom} title="Align Bottom">
              <AlignEndHorizontal size={16} />
            </button>
            <button className="icon-btn" style={{ flex: 1, padding: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }} onClick={handleDistributeVertical} title="Distribute Vertically">
              <AlignVerticalDistributeCenter size={16} />
            </button>
          </div>
        </div>
      )}

      {block.instrument !== 'percussion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Instrument</label>
          <select 
            value={block.instrument || 'piano'} 
            onChange={(e) => {
              const inst = e.target.value;
              getContextSt().mutateBlocks(
                [block.id],
                () => ({ instrument: inst, playedAt: Date.now(), playedVolumeMultiplier: 1 })
              );
            }}
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px' }}
          >
            <option value="piano">Piano</option>
            <option value="synth">Synth</option>
            <option value="bass">Bass</option>
          </select>
        </div>
      )}

      {useGameStore.getState().gamePhase !== 'arrange' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>{block.instrument === 'percussion' ? 'Drum Type' : 'Pitch'}</label>
        {block.instrument === 'percussion' ? (
          <select 
            value={block.pitch} 
            onChange={(e) => {
              getContextSt().mutateBlocks(
                [block.id],
                () => ({ pitch: e.target.value, playedAt: Date.now(), playedVolumeMultiplier: 1 })
              );
            }}
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px' }}
          >
            <option value="kick">Kick</option>
            <option value="snare">Snare</option>
            <option value="hihat">Hi-Hat</option>
            <option value="tom">Tom</option>
            <option value="cymbal">Cymbal</option>
          </select>
        ) : (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="action-btn" style={{ flex: 1 }} onClick={handleTuneDown}>-1</button>
            <button className="action-btn" style={{ flex: 1 }} onClick={handleTuneUp}>+1</button>
          </div>
        )}
      </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>Volume: {Math.round((block.volume ?? 1) * 100)}%</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={block.volume ?? 1} 
          onChange={(e) => {
            const vol = parseFloat(e.target.value);
            getContextSt().mutateBlocks(
              [block.id],
              () => ({ volume: vol, playedAt: Date.now(), playedVolumeMultiplier: 1 })
            );
          }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>Keybinding</label>
        <input 
          type="text" 
          maxLength={1}
          value={block.keyBinding || ''} 
          onChange={() => {}}
          onKeyDown={(e) => {
            e.preventDefault();
            if (e.key === 'Backspace' || e.key === 'Delete') {
              getContextSt().mutateBlocks(
                [block.id],
                () => ({ keyBinding: '' })
              );
            } else if (e.key.length === 1) {
              getContextSt().mutateBlocks(
                [block.id],
                () => ({ keyBinding: e.key.toLowerCase() })
              );
            }
          }}
          placeholder="No Key"
          className="uppercase"
          style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px', textAlign: 'center', caretColor: 'transparent' }}
        />
      </div>
    </div>
  );
};
