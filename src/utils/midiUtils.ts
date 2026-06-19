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
    const newBlocks: Parameters<typeof state.addBlock>[0][] = [];
    
    // Configurable mapping
    const timeToXScale = 200; // pixels per second
    const startX = 100;
    
    midi.tracks.forEach(track => {
      const instrument = track.instrument.percussion ? 'percussion' : 
                         (track.instrument.number >= 32 && track.instrument.number <= 39) ? 'bass' :
                         (track.instrument.number >= 80 && track.instrument.number <= 87) ? 'synth' : 'piano';
                         
      track.notes.forEach(note => {
         const x = startX + note.time * timeToXScale;
         
         // Base Y on pitch
         // Midi notes are roughly 21 to 108. C4 is 60.
         // Let's say C4 is at Y=500. Each semitone is 30 pixels.
         const y = 500 - (note.midi - 60) * 30;
         
         newBlocks.push({
             x,
             y,
             pitch: track.instrument.percussion ? 'kick' : note.name, // Simplified percussion mapping for now
             instrument: instrument,
             volume: note.velocity,
         });
      });
    });
    
    // Add all blocks
    // Since addBlock generates an ID, let's just add them one by one or create a new action.
    // To be efficient, we can update the store directly or just call addBlock.
    // Calling addBlock in a loop is fine for a few hundred notes. For thousands, a batch action is better.
    // Let's do it batch by updating state directly.
    const generateId = () => Math.random().toString(36).substring(2, 9);
    useStore.setState(s => ({
       blocks: [
         ...s.blocks, 
         ...newBlocks.map(b => ({ ...b, id: generateId(), playedAt: Date.now(), playedVolumeMultiplier: 1 }))
       ]
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
    
    // Place them relative to the current camera center so they are always visible
    const centerX = window.innerWidth / 2;
    const localCenterX = (centerX - state.camera.x) / state.camera.zoom;
    const startX = localCenterX - (cols * 80) / 2;
    
    const localStartY = (100 - state.camera.y) / state.camera.zoom;
    const startY = localStartY;

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
