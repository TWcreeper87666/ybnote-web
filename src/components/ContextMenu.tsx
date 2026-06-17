import React from 'react';
import { useStore } from '../store/useStore';
import { shiftPitch } from '../utils/pitchUtils';

export const ContextMenu: React.FC = () => {
  const { contextMenu, closeContextMenu, blocks, removeBlock, groupRects, removeGroupRect, selectedBlockIds, deleteSelected } = useStore();

  const menuRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x: contextMenu?.x || 0, y: contextMenu?.y || 0 });

  React.useEffect(() => {
    if (contextMenu && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = contextMenu.x;
      let newY = contextMenu.y;

      newX += 5;
      newY += 5;

      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 8;
      }
      if (newY + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 8;
      }

      setPos({ x: newX, y: newY });
    }
  }, [contextMenu?.x, contextMenu?.y]);

  if (!contextMenu) return null;

  const isGroupRect = contextMenu.blockId.startsWith('groupRect:');
  const actualId = isGroupRect ? contextMenu.blockId.split(':')[1] : contextMenu.blockId;

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
          left: pos.x,
          top: pos.y,
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
        <div style={{ fontSize: '12px', opacity: 0.7, padding: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          Group Area
        </div>
        <button className="action-btn" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', marginTop: '4px' }} onClick={handleDelete}>Delete Group</button>
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
      (b) => ({ pitch: shiftPitch(b.pitch, semitones), playedAt: Date.now() })
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
        left: pos.x,
        top: pos.y,
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
      <div style={{ fontSize: '12px', opacity: 0.7, padding: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {targetBlocks.length > 1 ? `${targetBlocks.length} Blocks Selected` : `Block: ${block.pitch}`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
        <label style={{ fontSize: '12px', opacity: 0.8 }}>{block.instrument === 'percussion' ? 'Drum Type' : 'Pitch'}</label>
        {block.instrument === 'percussion' ? (
          <select 
            value={block.pitch} 
            onChange={(e) => {
              useStore.getState().mutateBlocks(
                [block.id],
                () => ({ pitch: e.target.value, playedAt: Date.now() })
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
              () => ({ volume: vol, playedAt: Date.now() })
            );
          }} 
        />
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
                () => ({ instrument: inst, playedAt: Date.now() })
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

      <button className="action-btn" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', marginTop: '4px' }} onClick={handleDelete}>Delete</button>
    </div>
  );
};
