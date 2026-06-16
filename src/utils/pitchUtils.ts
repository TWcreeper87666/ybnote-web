export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Shifts a pitch string (e.g. 'C4') by a given number of semitones.
 * @param pitch The pitch string
 * @param delta Number of semitones to shift (positive or negative)
 * @returns The new pitch string, or the original if invalid
 */
export const shiftPitch = (pitch: string, delta: number): string => {
  const match = pitch.match(/^([A-G]#?)(\d)$/);
  if (!match) return pitch;

  const note = match[1];
  const octave = parseInt(match[2], 10);

  const noteIndex = NOTES.indexOf(note);
  if (noteIndex === -1) return pitch;

  let totalSemitones = octave * 12 + noteIndex + delta;
  
  // Ensure we don't go below C0
  if (totalSemitones < 0) totalSemitones = 0;

  const newOctave = Math.floor(totalSemitones / 12);
  const newNoteIndex = totalSemitones % 12;

  // Reasonable max octave (e.g., 8)
  if (newOctave > 8) return pitch;

  return `${NOTES[newNoteIndex]}${newOctave}`;
};
