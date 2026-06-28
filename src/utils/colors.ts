import * as PIXI from 'pixi.js';
import { DRUM_REGISTRY } from '../config/instruments';

const drumColors: Record<string, number> = Object.fromEntries(
  DRUM_REGISTRY.map(d => [d.pitch, d.color])
);

export const getPitchColorNumber = (pitch: string, pianoKeysCount: number) => {
  if (drumColors[pitch]) {
    return drumColors[pitch];
  }

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octaveMatch = pitch.match(/\d+$/);
  const octave = octaveMatch ? parseInt(octaveMatch[0]) : 4;
  const noteName = pitch.replace(/\d+$/, '');
  
  const noteIndex = notes.indexOf(noteName);
  if (noteIndex === -1) return 0x2dd4bf; 
  
  const absoluteNote = octave * 12 + noteIndex;
  const minNote = 3 * 12; // C3 = 36
  const maxNote = minNote + pianoKeysCount - 1; 
  const clampedNote = Math.max(minNote, Math.min(absoluteNote, maxNote));
  
  let hue = 0;
  if (maxNote > minNote) {
     hue = ((clampedNote - minNote) / (maxNote - minNote)) * 280;
  }
  
  const color = new PIXI.Color({ h: hue, s: 80, l: 60 });
  return color.toNumber();
};

export const getPitchColorHex = (pitch: string, pianoKeysCount: number) => {
  const num = getPitchColorNumber(pitch, pianoKeysCount);
  return new PIXI.Color(num).toHex();
};
