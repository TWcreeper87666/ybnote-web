import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { playNote } from '../../utils/audio';
import { X } from 'lucide-react';
import { getPitchColorHex } from '../../utils/colors';

const DRUMS = [
  { pitch: 'kick', label: 'Kick' },
  { pitch: 'snare', label: 'Snare' },
  { pitch: 'hihat', label: 'Hi-Hat' },
  { pitch: 'tom', label: 'Tom' },
  { pitch: 'cymbal', label: 'Cymbal' }
];

export const DrumKeyboard: React.FC = () => {
  const { mode, setMode } = useStore();
  const keyboardRef = useRef<HTMLDivElement>(null);
  
  const [drumPos, setDrumPos] = useState({ x: window.innerWidth / 2 - 150, y: window.innerHeight - 150 });
  const [isDraggingDrum, setIsDraggingDrum] = useState(false);
  const [drumDragOffset, setDrumDragOffset] = useState({ x: 0, y: 0 });

  const [draggedDrum, setDraggedDrum] = useState<{pitch: string, x: number, y: number} | null>(null);
  const [hitPitch, setHitPitch] = useState<string | null>(null);

  const triggerHit = (pitch: string) => {
    setHitPitch(pitch);
    setTimeout(() => {
      setHitPitch(prev => prev === pitch ? null : prev);
    }, 100);
  };

  useEffect(() => {
    if (!isDraggingDrum) return;
    const move = (e: PointerEvent) => setDrumPos({ x: e.clientX - drumDragOffset.x, y: e.clientY - drumDragOffset.y });
    const up = () => setIsDraggingDrum(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
  }, [isDraggingDrum, drumDragOffset]);

  if (mode !== 'drum') return null;

  const handleDrumHeaderDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDraggingDrum(true);
    setDrumDragOffset({ x: e.clientX - drumPos.x, y: e.clientY - drumPos.y });
  };

  const handleDrumPointerDown = (e: React.PointerEvent, pitch: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.button === 2) {
      triggerHit(pitch);
      playNote(pitch, 1, 'percussion');
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
    } else if (e.button === 0) {
      triggerHit(pitch);
      playNote(pitch, 1, 'percussion');
      setDraggedDrum({ pitch, x: e.clientX, y: e.clientY });

      const handlePointerMove = (moveEv: PointerEvent) => {
        setDraggedDrum(prev => prev ? { ...prev, x: moveEv.clientX, y: moveEv.clientY } : null);
      };

      const handlePointerUp = (upEv: PointerEvent) => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        
        setDraggedDrum(null);
        
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
          
          const newBlockId = state.addBlock({
            pitch,
            x: newX,
            y: newY,
            instrument: 'percussion'
          });
          state.selectBlock(newBlockId, false);
        }
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }
  };

  const handleDrumPointerEnter = (e: React.PointerEvent, pitch: string) => {
    if (e.buttons === 2) {
      triggerHit(pitch);
      playNote(pitch, 1, 'percussion');
    }
  };

  return (
    <>
      <div 
        className="piano-container glass-panel" 
        style={{ position: 'fixed', left: drumPos.x, top: drumPos.y, transform: 'none', bottom: 'auto', width: 'auto' }}
      >
        <div className="piano-header" onPointerDown={handleDrumHeaderDown} style={{ cursor: 'move', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="piano-title">Virtual Drum (Drag to Canvas)</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onPointerDown={e => e.stopPropagation()}>
            <button onClick={() => setMode('select')} className="icon-btn">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div ref={keyboardRef} className="keyboard-keys" style={{ flexWrap: 'wrap', gap: '8px', padding: '8px' }}>
          {DRUMS.map(drum => (
            <div 
              key={drum.pitch}
              onPointerDown={(e) => handleDrumPointerDown(e, drum.pitch)}
              onPointerEnter={(e) => handleDrumPointerEnter(e, drum.pitch)}
              className={`drum-pad ${hitPitch === drum.pitch ? 'hit' : ''}`}
              style={{
                backgroundColor: getPitchColorHex(drum.pitch, 36),
              }}
            >
              {drum.label}
            </div>
          ))}
        </div>
      </div>

      {draggedDrum && (
        <div style={{
          position: 'fixed',
          left: draggedDrum.x - 30,
          top: draggedDrum.y - 30,
          width: 60, height: 60,
          backgroundColor: getPitchColorHex(draggedDrum.pitch, 36),
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.8,
          border: '2px solid white'
        }}></div>
      )}
    </>
  );
};
