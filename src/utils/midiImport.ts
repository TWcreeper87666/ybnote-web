import { Midi } from '@tonejs/midi';
import type { ParsedMidiData, EditorTrack, EditorNote } from '../types';

export const parseMidiFile = async (arrayBuffer: ArrayBuffer): Promise<ParsedMidiData> => {
  const midi = new Midi(arrayBuffer);

  let bpm = 120;
  if (midi.header.tempos.length > 0) {
    bpm = midi.header.tempos[0].bpm;
  }

  const tracks: EditorTrack[] = [];
  midi.tracks.forEach((track, index) => {
    if (track.notes.length === 0) return;

    const notes: EditorNote[] = track.notes.map((n, ni) => ({
      id: `t${index}-n${ni}-${Date.now()}`,
      pitch: n.midi,
      name: n.name,
      timeStart: n.time,
      duration: n.duration,
      velocity: n.velocity,
    }));

    const instrument = track.instrument.percussion
      ? 'percussion'
      : (track.instrument.number >= 32 && track.instrument.number <= 39)
        ? 'bass'
        : (track.instrument.number >= 80 && track.instrument.number <= 87)
          ? 'synth'
          : 'piano';

    tracks.push({
      id: index,
      name: track.name || `Track ${index + 1}`,
      notes,
      instrument,
    });
  });

  return {
    bpm,
    duration: midi.duration,
    tracks,
  };
};
