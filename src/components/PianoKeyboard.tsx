import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { playNote } from '../utils/audio';
import { X } from 'lucide-react';
import { getPitchColorHex } from '../utils/colors';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const PianoKeyboard: React.FC = () => {
  const { isPianoOpen, togglePiano, addBlock, camera, pianoKeysCount } = useStore();
  const keyboardRef = useRef<HTMLDivElement>(null);
  
  // Draggable piano state
  const [pianoPos, setPianoPos] = useState({ x: window.innerWidth / 2 - 200, y: window.innerHeight - 200 });
  const [isDraggingPiano, setIsDraggingPiano] = useState(false);
  const [pianoDragOffset, setPianoDragOffset] = useState({ x: 0, y: 0 });

  // Drag block from piano state
  const [draggedPitch, setDraggedPitch] = useState<{pitch: string, x: number, y: number} | null>(null);

  useEffect(() => {
    if (!isDraggingPiano) return;
    const move = (e: PointerEvent) => setPianoPos({ x: e.clientX - pianoDragOffset.x, y: e.clientY - pianoDragOffset.y });
    const up = () => setIsDraggingPiano(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
  }, [isDraggingPiano, pianoDragOffset]);

  if (!isPianoOpen) return null;

  const handlePianoHeaderDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDraggingPiano(true);
    setPianoDragOffset({ x: e.clientX - pianoPos.x, y: e.clientY - pianoPos.y });
  };

  const handleKeyPointerDown = (e: React.PointerEvent, pitch: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.button === 2) {
      playNote(pitch);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
    } else if (e.button === 0) {
      playNote(pitch);
      setDraggedPitch({ pitch, x: e.clientX, y: e.clientY });

      const handlePointerMove = (moveEv: PointerEvent) => {
        setDraggedPitch(prev => prev ? { ...prev, x: moveEv.clientX, y: moveEv.clientY } : null);
      };

      const handlePointerUp = (upEv: PointerEvent) => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        
        setDraggedPitch(null);
        
        if (keyboardRef.current && !keyboardRef.current.contains(upEv.target as Node)) {
          const state = useStore.getState();
          const rect = document.body.getBoundingClientRect(); 
          const x = (upEv.clientX - rect.left - state.camera.x) / state.camera.zoom;
          const y = (upEv.clientY - rect.top - state.camera.y) / state.camera.zoom;
          
          let newX = x - 30; // center of 60x60 block
          let newY = y - 30;
          
          if (state.snapToGrid) {
            const gridSize = 60;
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
          }
          
          state.addBlock({
            pitch,
            x: newX,
            y: newY,
            instrument: 'piano'
          });
        }
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }
  };

  const handleKeyPointerEnter = (e: React.PointerEvent, pitch: string) => {
    if (e.buttons === 2) {
      playNote(pitch);
    }
  };

  const renderKeys = () => {
    const keys = [];
    for (let i = 0; i < pianoKeysCount; i++) {
      const octave = 3 + Math.floor(i / 12);
      const note = NOTES[i % 12];
      const isBlack = note.includes('#');
      const pitch = `${note}${octave}`;
      
      if (isBlack) {
        keys.push(
          <div 
            key={pitch}
            onPointerDown={(e) => handleKeyPointerDown(e, pitch)}
            onPointerEnter={(e) => handleKeyPointerEnter(e, pitch)}
            className="piano-key black-key"
          >
            <span className="key-label">{pitch}</span>
          </div>
        );
      } else {
        keys.push(
          <div 
            key={pitch}
            onPointerDown={(e) => handleKeyPointerDown(e, pitch)}
            onPointerEnter={(e) => handleKeyPointerEnter(e, pitch)}
            className="piano-key white-key"
          >
            <span className="key-label">{pitch}</span>
          </div>
        );
      }
    }
    return keys;
  };

  return (
    <>
      <div 
        className="piano-container glass-panel" 
        style={{ position: 'fixed', left: pianoPos.x, top: pianoPos.y, transform: 'none', bottom: 'auto' }}
      >
        <div className="piano-header" onPointerDown={handlePianoHeaderDown} style={{ cursor: 'move' }}>
          <span className="piano-title">Virtual Piano (Drag header to move, keys to Canvas)</span>
          <button onClick={togglePiano} className="icon-btn" onPointerDown={e => e.stopPropagation()}>
            <X size={18} />
          </button>
        </div>
        
        <div ref={keyboardRef} className="keyboard-keys" style={{ flexWrap: 'wrap', maxWidth: '80vw' }}>
          {renderKeys()}
        </div>
      </div>

      {draggedPitch && (
        <div style={{
          position: 'fixed',
          left: draggedPitch.x - 30,
          top: draggedPitch.y - 30,
          width: 60, height: 60,
          backgroundColor: getPitchColorHex(draggedPitch.pitch, pianoKeysCount),
          borderRadius: 8,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.8,
          border: '2px solid white'
        }}></div>
      )}
    </>
  );
};
