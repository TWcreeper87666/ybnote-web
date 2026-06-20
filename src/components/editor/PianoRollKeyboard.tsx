import React from 'react';

const MAX_PITCH = 127;
const ROW_HEIGHT = 16;
const KEYBOARD_WIDTH = 60;
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface PianoRollKeyboardProps {
  scrollTop: number;
  height: number;
}

export const PianoRollKeyboard: React.FC<PianoRollKeyboardProps> = ({ scrollTop, height }) => {
  const keys: React.ReactNode[] = [];

  for (let pitch = MAX_PITCH; pitch >= 0; pitch--) {
    const noteIndex = pitch % 12;
    const octave = Math.floor(pitch / 12) - 1;
    const noteName = NOTES[noteIndex];
    const isBlack = noteName.includes('#');
    const isC = noteIndex === 0;
    const y = (MAX_PITCH - pitch) * ROW_HEIGHT - scrollTop;

    // Culling — only render visible keys
    if (y + ROW_HEIGHT < 0 || y > height) continue;

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
        {isC && (
          <span className="pr-key-label">C{octave}</span>
        )}
        {!isBlack && !isC && (
          <span className="pr-key-label-dim">{noteName}{octave}</span>
        )}
      </div>
    );
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
