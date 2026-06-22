import React from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';

const MAX_PITCH = 127;
const ROW_HEIGHT = 16;
const KEYBOARD_WIDTH = 60;
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface PianoRollKeyboardProps {
  scrollTop: number;
  height: number;
}

export const PianoRollKeyboard: React.FC<PianoRollKeyboardProps> = ({ scrollTop, height }) => {
  const track = useLevelEditorStore(state => state.getCurrentTrack());
  const isDrumMode = track?.instrument === 'percussion' || track?.instrument === 'group_rect';

  const keys: React.ReactNode[] = [];

  for (let pitch = MAX_PITCH; pitch >= 12; pitch--) {
    const noteIndex = pitch % 12;
    const octave = Math.floor(pitch / 12) - 1;
    const noteName = NOTES[noteIndex];
    const isBlack = noteName.includes('#');
    const isC = noteIndex === 0;
    const y = (MAX_PITCH - pitch) * ROW_HEIGHT - scrollTop;

    // Culling — only render visible keys
    if (y + ROW_HEIGHT < 0 || y > height) continue;

    if (isDrumMode) {
      let label = `LANE ${pitch}`;
      if (track?.instrument === 'percussion') {
        switch (noteIndex) {
          case 0: label = 'Kick'; break;      // C
          case 2: label = 'Snare'; break;     // D
          case 4: label = 'Hi-Hat'; break;    // E
          case 5: label = 'Tom'; break;       // F
          case 7: label = 'Cymbal'; break;    // G
          default: label = ''; break;
        }
      }

      keys.push(
        <div
          key={pitch}
          className="pr-key pr-key-white"
          style={{
            position: 'absolute',
            top: y,
            left: 0,
            width: KEYBOARD_WIDTH,
            height: ROW_HEIGHT,
            borderBottom: '1px solid #333',
            background: pitch % 2 === 0 ? '#1a1a22' : '#22222a'
          }}
        >
          <span className="pr-key-label" style={{ left: 8, opacity: 0.8, fontSize: 10 }}>{label}</span>
        </div>
      );
    } else {
      keys.push(
        <div
          key={pitch}
          className={`pr-key ${isBlack ? 'pr-key-black' : 'pr-key-white'} ${isC ? 'pr-key-c' : ''}`}
          style={{
            position: 'absolute',
            top: y,
            left: 0,
            width: KEYBOARD_WIDTH,
            height: ROW_HEIGHT,
          }}
        >
          {isC ? (
            <span className="pr-key-label">C{octave}</span>
          ) : (
            <span className="pr-key-label-dim">{noteName}{octave}</span>
          )}
        </div>
      );
    }
  }

  return (
    <div
      className="pr-keyboard"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: KEYBOARD_WIDTH,
        height: '100%',
        overflow: 'hidden',
        zIndex: 5,
        background: '#1a1a22',
        borderRight: '1px solid #333',
      }}
    >
      {keys}
    </div>
  );
};
