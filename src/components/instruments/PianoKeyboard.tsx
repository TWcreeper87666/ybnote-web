import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { playNote } from '../../utils/audio';
import { X } from 'lucide-react';
import { getPitchColorHex } from '../../utils/colors';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const PianoKeyboard: React.FC = () => {
  const { isPianoOpen, togglePiano } = useStore();
  const pianoKeysCount = 36;
  const keyboardRef = useRef<HTMLDivElement>(null);
  
  // Draggable piano state
  const [hasDragged, setHasDragged] = useState(false);
  const [pianoPos, setPianoPos] = useState({ x: 0, y: 0 });
  const [isDraggingPiano, setIsDraggingPiano] = useState(false);
  const [pianoDragOffset, setPianoDragOffset] = useState({ x: 0, y: 0 });

  // Drag block from piano state
  const [draggedPitch, setDraggedPitch] = useState<{pitch: string, x: number, y: number} | null>(null);

  const [instrument, setInstrument] = useState('piano');

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
    
    if (!hasDragged) {
      if (keyboardRef.current && keyboardRef.current.parentElement) {
        const rect = keyboardRef.current.parentElement.getBoundingClientRect();
        setPianoPos({ x: rect.left, y: rect.top });
        setPianoDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      setHasDragged(true);
    } else {
      setPianoDragOffset({ x: e.clientX - pianoPos.x, y: e.clientY - pianoPos.y });
    }
    setIsDraggingPiano(true);
  };

  const handleKeyPointerDown = (e: React.PointerEvent, pitch: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.button === 2) {
      playNote(pitch, 1, instrument);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
    } else if (e.button === 0) {
      playNote(pitch, 1, instrument);
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
            const snapSize = 30;
            newX = Math.round(newX / snapSize) * snapSize;
            newY = Math.round(newY / snapSize) * snapSize;
          }
          
          state.addBlock({
            pitch,
            x: newX,
            y: newY,
            instrument: instrument
          });
        }
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }
  };

  const handleKeyPointerEnter = (e: React.PointerEvent, pitch: string) => {
    if (e.buttons === 2) {
      playNote(pitch, 1, instrument);
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
        style={hasDragged ? { position: 'fixed', left: pianoPos.x, top: pianoPos.y, transform: 'none', bottom: 'auto' } : undefined}
      >
        <div className="piano-header" onPointerDown={handlePianoHeaderDown} style={{ cursor: 'move', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="piano-title">Virtual Piano (Drag keys to Canvas)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onPointerDown={e => e.stopPropagation()}>
            <select 
              value={instrument} 
              onChange={(e) => setInstrument(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '2px 4px', fontSize: '12px' }}
            >
              <option value="piano">Piano</option>
              <option value="synth">Synth</option>
              <option value="bass">Bass</option>
            </select>
            <button onClick={togglePiano} className="icon-btn">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div ref={keyboardRef} className="keyboard-keys" style={{ flexWrap: 'nowrap' }}>
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
