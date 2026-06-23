import { Midi } from '@tonejs/midi';
import { useStore } from '../store/useStore';
import type { Block } from '../types';

export const exportRecordedEventsToMidi = () => {
  const state = useStore.getState();
  const { recordedEvents, blocks, groupRects } = state;

  if (recordedEvents.length === 0) {
    alert("No events recorded!");
    return;
  }

  const midi = new Midi();
  
  // Create tracks for different instruments
  const tracksByInstrument = new Map<string, ReturnType<typeof midi.addTrack>>();
  
  const getTrack = (instrument: string) => {
    if (!tracksByInstrument.has(instrument)) {
      const track = midi.addTrack();
      track.name = instrument;
      // Set simple instrument defaults
      if (instrument === 'piano') track.instrument.number = 0; // Acoustic Grand Piano
      else if (instrument === 'bass') track.instrument.number = 33; // Electric Bass (finger)
      else if (instrument === 'synth') track.instrument.number = 81; // Lead 2 (sawtooth)
      else if (instrument === 'percussion') {
          track.channel = 9; // Channel 9 (10 in 1-based) is percussion
      }
      tracksByInstrument.set(instrument, track);
    }
    return tracksByInstrument.get(instrument)!;
  };

  const getMidiNoteString = (pitch: string, instrument: string) => {
     if (instrument === 'percussion') {
        if (pitch === 'kick') return 'C1';
        if (pitch === 'snare') return 'D1';
        if (pitch === 'hihat') return 'F#1';
        if (pitch === 'tom1') return 'C2';
        if (pitch === 'tom2') return 'A1';
        if (pitch === 'tom3') return 'F1';
        if (pitch === 'clap') return 'D#1';
        if (pitch === 'crash') return 'C#2';
        return 'C1';
     }
     return pitch;
  };

  recordedEvents.forEach(event => {
    const timeInSeconds = event.time / 1000;
    
    if (event.type === 'block') {
      const block = blocks.find(b => b.id === event.targetId);
      if (block) {
        const track = getTrack(block.instrument || 'piano');
        track.addNote({
          name: getMidiNoteString(block.pitch, block.instrument || 'piano'),
          time: timeInSeconds,
          duration: 0.5, // Default duration since we only trigger onsets
          velocity: block.volume ?? 1
        });
      }
    } else if (event.type === 'groupRect') {
      const groupRect = groupRects.find(g => g.id === event.targetId);
      if (groupRect) {
        // Find blocks inside the groupRect
        const isInside = (bx: number, by: number, bw: number, bh: number) => {
          return bx < groupRect.x + groupRect.w && bx + bw > groupRect.x && by < groupRect.y + groupRect.h && by + bh > groupRect.y;
        };
        const blocksInside = blocks.filter(b => isInside(b.x, b.y, 60, 60));
        
        blocksInside.forEach(block => {
           const track = getTrack(block.instrument || 'piano');
           track.addNote({
             name: getMidiNoteString(block.pitch, block.instrument || 'piano'),
             time: timeInSeconds,
             duration: 0.5,
             velocity: (block.volume ?? 1) * (groupRect.volume ?? 1)
           });
        });
      }
    }
  });

  const arrayBuffer = midi.toArray();
  const blob = new Blob([arrayBuffer as unknown as ArrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ybnote_recording_${new Date().getTime()}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const parseMidiForGame = async (file: File, arrangeBy: 'sequence' | 'pitch' = 'sequence') => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    
    const gameBlocks: Block[] = [];
    const gameEvents: { time: number; pitch: string; instrument: string; blockId: string }[] = [];
    const generateId = () => Math.random().toString(36).substring(2, 9);
    
    // 1. Extract unique pitch/instrument combinations
    const uniqueNotes = new Map<string, { pitch: string, instrument: string, midiNumber: number }>();
    
    midi.tracks.forEach(track => {
      const instrument = track.instrument.percussion ? 'percussion' : 
                         (track.instrument.number >= 32 && track.instrument.number <= 39) ? 'bass' :
                         (track.instrument.number >= 80 && track.instrument.number <= 87) ? 'synth' : 'piano';
                         
      track.notes.forEach(note => {
         const pitch = track.instrument.percussion ? 'kick' : note.name;
         const key = `${pitch}-${instrument}`;
         if (!uniqueNotes.has(key)) {
             uniqueNotes.set(key, { pitch, instrument, midiNumber: note.midi });
         }
      });
    });

    // 2. Generate blocks for unique notes in a simple grid
    let i = 0;
    const cols = 8;
    
    // Place them at the absolute center of the canvas (0, 0)
    const numRows = Math.ceil(uniqueNotes.size / cols);
    const startX = - (Math.min(cols, uniqueNotes.size) * 80) / 2 + 10;
    const startY = - (numRows * 80) / 2 + 10;

    const blockIdMap = new Map<string, string>(); // Maps 'pitch-instrument' to blockId

    const notesArray = Array.from(uniqueNotes.entries());
    if (arrangeBy === 'pitch') {
        notesArray.sort((a, b) => a[1].midiNumber - b[1].midiNumber);
    }

    for (const [key, noteInfo] of notesArray) {
        const id = generateId();
        blockIdMap.set(key, id);
        gameBlocks.push({
            id,
            x: startX + (i % cols) * 80,
            y: startY + Math.floor(i / cols) * 80,
            pitch: noteInfo.pitch,
            instrument: noteInfo.instrument,
            volume: 1
        });
        i++;
    }

    // 3. Generate events
    midi.tracks.forEach(track => {
      const instrument = track.instrument.percussion ? 'percussion' : 
                         (track.instrument.number >= 32 && track.instrument.number <= 39) ? 'bass' :
                         (track.instrument.number >= 80 && track.instrument.number <= 87) ? 'synth' : 'piano';
                         
      track.notes.forEach(note => {
         const pitch = track.instrument.percussion ? 'kick' : note.name;
         const key = `${pitch}-${instrument}`;
         const blockId = blockIdMap.get(key)!;
         
         gameEvents.push({
             time: note.time * 1000, // convert to ms
             pitch,
             instrument,
             blockId
         });
      });
    });

    // Sort events by time
    gameEvents.sort((a, b) => a.time - b.time);

    return { gameBlocks, gameEvents };
};

export const parseMidiToPocketBlocks = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    
    const uniqueNotes = new Map<string, { pitch: string, instrument: string, midiNumber: number, firstTime: number }>();
    
    midi.tracks.forEach(track => {
      const instrument = track.instrument.percussion ? 'percussion' : 
                         (track.instrument.number >= 32 && track.instrument.number <= 39) ? 'bass' :
                         (track.instrument.number >= 80 && track.instrument.number <= 87) ? 'synth' : 'piano';
                         
      track.notes.forEach(note => {
         const pitch = track.instrument.percussion ? 'kick' : note.name;
         const key = `${pitch}-${instrument}`;
         if (!uniqueNotes.has(key)) {
             uniqueNotes.set(key, { pitch, instrument, midiNumber: note.midi, firstTime: note.time });
         } else {
             const existing = uniqueNotes.get(key)!;
             if (note.time < existing.firstTime) {
                 existing.firstTime = note.time;
             }
         }
      });
    });

    const generateId = () => Math.random().toString(36).substring(2, 9);
    
    const notesArray = Array.from(uniqueNotes.values());
    
    // Initial sort can just be pitch
    notesArray.sort((a, b) => a.midiNumber - b.midiNumber);

    const pocketBlocks: Block[] = [];
    
    notesArray.forEach((noteInfo) => {
        // We will assign x and y later during the render based on sort mode, but we can store them here
        pocketBlocks.push({
            id: generateId(),
            x: 0,
            y: 0,
            pitch: noteInfo.pitch,
            instrument: noteInfo.instrument,
            volume: 1,
            originalTime: noteInfo.firstTime,
            midiNumber: noteInfo.midiNumber
        });
    });

    useStore.getState().setPocketBlocks(pocketBlocks);
};

export const parseParsedMidiDataToPocketBlocks = (midiData: import('../types').ParsedMidiData) => {
    const uniqueNotes = new Map<string, { pitch: string, instrument: string, midiNumber: number, firstTime: number }>();
    
    midiData.tracks.forEach(track => {
      const instrument = track.instrument;
      track.notes.forEach(note => {
         const pitch = note.name;
         const key = `${pitch}-${instrument}`;
         if (!uniqueNotes.has(key)) {
             // We can guess midiNumber roughly if it's missing, but it's optional
             // Alternatively, let's just parse the pitch string if we really need it, but note.midi might exist if we add it to EditorNote. 
             // Wait, EditorNote doesn't have midi number. We can just use string compare for sort, or assume pocketCanvas can sort by pitch name if midiNumber is 0.
             uniqueNotes.set(key, { pitch, instrument, midiNumber: 0, firstTime: note.timeStart });
         } else {
             const existing = uniqueNotes.get(key)!;
             if (note.timeStart < existing.firstTime) {
                 existing.firstTime = note.timeStart;
             }
         }
      });
    });

    const generateId = () => Math.random().toString(36).substring(2, 9);
    const notesArray = Array.from(uniqueNotes.values());
    
    // Simple sort by pitch name since midiNumber isn't strictly available in ParsedMidiData easily
    notesArray.sort((a, b) => a.pitch.localeCompare(b.pitch));

    const pocketBlocks: Block[] = [];
    notesArray.forEach((noteInfo) => {
        pocketBlocks.push({
            id: generateId(),
            x: 0,
            y: 0,
            pitch: noteInfo.pitch,
            instrument: noteInfo.instrument,
            volume: 1,
            originalTime: noteInfo.firstTime,
            midiNumber: noteInfo.midiNumber
        });
    });

    useStore.getState().setPocketBlocks(pocketBlocks);
};
