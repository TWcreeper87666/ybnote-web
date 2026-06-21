import { Midi } from '@tonejs/midi';
import { useStore } from '../store/useStore';

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
  const blob = new Blob([arrayBuffer as any], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ybnote_recording_${new Date().getTime()}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importMidiToBlocks = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    
    const state = useStore.getState();
    
    const allNotes: { time: number, pitch: string, instrument: string, volume: number, midiNumber: number }[] = [];
    midi.tracks.forEach(track => {
      const instrument = track.instrument.percussion ? 'percussion' : 
                         (track.instrument.number >= 32 && track.instrument.number <= 39) ? 'bass' :
                         (track.instrument.number >= 80 && track.instrument.number <= 87) ? 'synth' : 'piano';
                         
      track.notes.forEach(note => {
         const pitch = track.instrument.percussion ? 'kick' : note.name;
         allNotes.push({ time: note.time, pitch, instrument, volume: note.velocity, midiNumber: note.midi });
      });
    });

    allNotes.sort((a, b) => a.time - b.time);

    const chords: { notes: typeof allNotes }[] = [];
    let currentChord: typeof allNotes = [];
    let lastTime = -1;

    for (const note of allNotes) {
        if (lastTime === -1 || Math.abs(note.time - lastTime) < 0.05) {
            currentChord.push(note);
            lastTime = note.time;
        } else {
            chords.push({ notes: currentChord });
            currentChord = [note];
            lastTime = note.time;
        }
    }
    if (currentChord.length > 0) {
        chords.push({ notes: currentChord });
    }

    const uniqueChordsMap = new Map<string, { notes: typeof allNotes }>();
    for (const chord of chords) {
        const sortedNotes = [...chord.notes].sort((a, b) => b.midiNumber - a.midiNumber);
        const key = sortedNotes.map(n => `${n.pitch}-${n.instrument}`).join('|');
        if (!uniqueChordsMap.has(key)) {
            uniqueChordsMap.set(key, { notes: sortedNotes });
        }
    }

    const uniqueChords = Array.from(uniqueChordsMap.values());
    
    const newBlocks: typeof state.blocks = [];
    const newGroupRects: typeof state.groupRects = [];
    const newGroups: typeof state.groups = [];
    const generateId = () => Math.random().toString(36).substring(2, 9);
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const localCenterX = (centerX - state.camera.x) / state.camera.zoom;
    const localCenterY = (centerY - state.camera.y) / state.camera.zoom;

    const cols = 8;
    const rows = Math.ceil(uniqueChords.length / cols);
    const spacingX = 150;
    const spacingY_row = 400; 
    const spacingY_note = 80;

    const startX = localCenterX - (Math.min(cols, uniqueChords.length) * spacingX) / 2 + spacingX / 2;
    const overallStartY = localCenterY - (rows * spacingY_row) / 2 + spacingY_row / 2;

    uniqueChords.forEach((chord, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * spacingX;
        const notes = chord.notes;
        
        const startY = overallStartY + row * spacingY_row - (notes.length * spacingY_note) / 2;
        
        let groupId: string | undefined = undefined;
        if (notes.length > 1) {
            groupId = generateId();
            const groupRectId = generateId();
            newGroups.push({ id: groupId, name: `Chord Group ${i + 1}` });
            newGroupRects.push({
                id: groupRectId,
                name: `Chord ${i + 1}`,
                x: x - 20,
                y: startY - 20,
                w: 100, 
                h: (notes.length - 1) * spacingY_note + 100,
                enabled: true,
                groupId: groupId
            });
        }

        notes.forEach((note, j) => {
            const y = startY + j * spacingY_note;
            newBlocks.push({
                id: generateId(),
                x,
                y,
                pitch: note.pitch,
                instrument: note.instrument,
                volume: note.volume,
                playedAt: Date.now(),
                playedVolumeMultiplier: 1,
                groupId
            });
        });
    });

    useStore.setState(s => ({
       blocks: [...s.blocks, ...newBlocks],
       groupRects: [...s.groupRects, ...newGroupRects],
       groups: [...s.groups, ...newGroups]
    }));
};

export const parseMidiForGame = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const midi = new Midi(arrayBuffer);
    
    const state = useStore.getState();
    const gameBlocks: typeof state.gameBlocks = [];
    const gameEvents: typeof state.gameEvents = [];
    const generateId = () => Math.random().toString(36).substring(2, 9);
    
    // 1. Extract unique pitch/instrument combinations
    const uniqueNotes = new Map<string, { pitch: string, instrument: string }>();
    
    midi.tracks.forEach(track => {
      const instrument = track.instrument.percussion ? 'percussion' : 
                         (track.instrument.number >= 32 && track.instrument.number <= 39) ? 'bass' :
                         (track.instrument.number >= 80 && track.instrument.number <= 87) ? 'synth' : 'piano';
                         
      track.notes.forEach(note => {
         const pitch = track.instrument.percussion ? 'kick' : note.name;
         const key = `${pitch}-${instrument}`;
         if (!uniqueNotes.has(key)) {
             uniqueNotes.set(key, { pitch, instrument });
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

    for (const [key, noteInfo] of uniqueNotes.entries()) {
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
