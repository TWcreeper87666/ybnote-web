import React from 'react';
import { useStore } from '../store/useStore';
import { playNote } from '../utils/audio';

export const ContextMenu: React.FC = () => {
  const { contextMenu, closeContextMenu, updateBlock, blocks, removeBlock, updateBlocks, selectedBlockIds, deleteSelectedBlocks } = useStore();

  if (!contextMenu) return null;

  const block = blocks.find(b => b.id === contextMenu.blockId);
  if (!block) return null;

  const targetBlocks = selectedBlockIds.length > 0 && selectedBlockIds.includes(block.id) 
    ? blocks.filter(b => selectedBlockIds.includes(b.id))
    : [block];

  const tunePitch = (semitones: number) => {
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const updates = targetBlocks.map(b => {
      const octaveMatch = b.pitch.match(/\d+$/);
      const octave = octaveMatch ? parseInt(octaveMatch[0]) : 4;
      const noteName = b.pitch.replace(/\d+$/, '');
      
      const noteIndex = NOTES.indexOf(noteName);
      if (noteIndex === -1) return null;
      
      const absoluteNote = octave * 12 + noteIndex + semitones;
      if (absoluteNote < 12) return null;
      
      const newOctave = Math.floor(absoluteNote / 12);
      const newNoteIndex = absoluteNote % 12;
      const newPitch = `${NOTES[newNoteIndex]}${newOctave}`;
      
      return { id: b.id, updates: { pitch: newPitch, playedAt: Date.now() } };
    }).filter(Boolean) as {id: string, updates: any}[];

    updateBlocks(updates);
    updates.forEach(u => playNote(u.updates.pitch!));
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
      deleteSelectedBlocks();
    } else {
      removeBlock(block.id);
    }
    closeContextMenu();
  };

  return (
    <div 
      className="context-menu glass-panel"
      style={{
        position: 'fixed',
        left: contextMenu.x,
        top: contextMenu.y,
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
      <button className="action-btn" onClick={handleTuneUp}>Pitch +1</button>
      <button className="action-btn" onClick={handleTuneDown}>Pitch -1</button>
      <button className="action-btn" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }} onClick={handleDelete}>Delete</button>
    </div>
  );
};
