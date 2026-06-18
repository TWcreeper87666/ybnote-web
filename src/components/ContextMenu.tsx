import React from 'react';
import { useStore } from '../store/useStore';
import { shiftPitch } from '../utils/pitchUtils';
import { Trash2, Search, Activity, Square, Music } from 'lucide-react';

export const ContextMenu: React.FC = () => {
  const { contextMenu, closeContextMenu, blocks, removeBlock, groupRects, removeGroupRect, selectedBlockIds, deleteSelected } = useStore();

  const menuRef = React.useRef<HTMLDivElement>(null);
  const [measuredPos, setMeasuredPos] = React.useState<{x: number, y: number} | null>(null);
  const prevContextMenuRef = React.useRef(contextMenu);

  if (prevContextMenuRef.current !== contextMenu) {
    prevContextMenuRef.current = contextMenu;
    setMeasuredPos(null);
  }

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

  if (!contextMenu) return null;

  const displayX = measuredPos ? measuredPos.x : contextMenu.x - 60;
  const displayY = measuredPos ? measuredPos.y : contextMenu.y + 5;
  const visibility = measuredPos ? 'visible' : 'hidden';

  const isGroupRect = contextMenu.blockId.startsWith('groupRect:');
  const isTrack = contextMenu.blockId.startsWith('track:');
  const actualId = isGroupRect ? contextMenu.blockId.split(':')[1] : (isTrack ? contextMenu.blockId.split(':')[1] : contextMenu.blockId);

  if (isTrack) {
    const track = useStore.getState().tracks.find(t => t.id === actualId);
    if (!track) return null;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      useStore.getState().deleteTrack(track.id);
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
          visibility: visibility as any,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            <Activity size={14} /> Track
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#9ca3af', backgroundColor: 'transparent', borderRadius: '4px' }} 
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
              onClick={handleDelete}
              title="Delete Track"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Name</label>
          <input 
            type="text" 
            value={track.name || ''} 
            onChange={(e) => {
              useStore.getState().updateTrack(track.id, { name: e.target.value });
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
              useStore.getState().updateTrack(track.id, { bpm: Number(e.target.value) || 120 });
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
              useStore.getState().updateTrack(track.id, { loop: loopVal as any });
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
          onClick={() => useStore.getState().updateTrack(track.id, { enabled: track.enabled === false ? true : false })}
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
    const rect = groupRects.find(g => g.id === actualId);
    if (!rect) return null;

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      removeGroupRect(rect.id);
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
          visibility: visibility as any,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            <Square size={14} /> Group Area
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#9ca3af', backgroundColor: 'transparent', borderRadius: '4px' }} 
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
              useStore.getState().updateGroupRect(rect.id, { name: e.target.value });
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
              useStore.getState().updateGroupRect(rect.id, { volume: vol });
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
                useStore.getState().updateGroupRect(rect.id, { keyBinding: '' });
              } else if (e.key.length === 1) {
                useStore.getState().updateGroupRect(rect.id, { keyBinding: e.key.toLowerCase() });
              }
            }}
            placeholder="No Key"
            className="uppercase"
            style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px', textAlign: 'center', caretColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  const block = blocks.find(b => b.id === actualId);
  if (!block) return null;

  const targetBlocks = selectedBlockIds.length > 0 && selectedBlockIds.includes(block.id) 
    ? blocks.filter(b => selectedBlockIds.includes(b.id))
    : [block];

  const tunePitch = (semitones: number) => {
    useStore.getState().mutateBlocks(
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
      deleteSelected();
    } else {
      removeBlock(block.id);
    }
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
        visibility: visibility as any,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            <Music size={14} /> {targetBlocks.length > 1 ? `${targetBlocks.length} Blocks` : `Block: ${block.pitch}`}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '16px' }}>
            <button 
              className="icon-btn" 
              style={{ padding: '4px', color: '#9ca3af', backgroundColor: 'transparent', borderRadius: '4px' }} 
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
              onClick={handleDelete}
              title={targetBlocks.length > 1 ? 'Delete Selected' : 'Delete Block'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

      {block.instrument !== 'percussion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
          <label style={{ fontSize: '12px', opacity: 0.8 }}>Instrument</label>
          <select 
            value={block.instrument || 'piano'} 
            onChange={(e) => {
              const inst = e.target.value;
              useStore.getState().mutateBlocks(
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>{block.instrument === 'percussion' ? 'Drum Type' : 'Pitch'}</label>
        {block.instrument === 'percussion' ? (
          <select 
            value={block.pitch} 
            onChange={(e) => {
              useStore.getState().mutateBlocks(
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
            useStore.getState().mutateBlocks(
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
              useStore.getState().mutateBlocks(
                [block.id],
                () => ({ keyBinding: '' })
              );
            } else if (e.key.length === 1) {
              useStore.getState().mutateBlocks(
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
