import { Midi } from '@tonejs/midi';
import type { ParsedMidiData, EditorTrack } from '../store/useLevelEditorStore';

export const generateMidiBlob = (midiData: ParsedMidiData): Blob => {
  const midi = new Midi();
  midi.header.setTempo(midiData.bpm);

  midiData.tracks.forEach((track: EditorTrack) => {
    const midiTrack = midi.addTrack();
    midiTrack.name = track.name;
    
    // Attempt to map instrument string back to basic program numbers
    if (track.instrument === 'percussion') {
      midiTrack.channel = 9; // channel 10 for percussion
    }
    
    if (track.instrument !== 'percussion') {
      // @ts-ignore - The types for @tonejs/midi don't expose instrument directly on track creation easily, 
      // but it handles program numbers internally if we could set it. 
      // For now, track names and notes are the most critical data.
    }

    track.notes.forEach(note => {
      midiTrack.addNote({
        midi: note.pitch,
        time: note.timeStart,
        duration: note.duration,
        velocity: note.velocity,
      });
    });
  });

  const uint8Array = midi.toArray();
  const buffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'audio/midi' });
};

export const exportToMidiFile = (midiData: ParsedMidiData) => {
  const blob = generateMidiBlob(midiData);
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `exported_${Date.now()}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
