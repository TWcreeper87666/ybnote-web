import * as Tone from 'tone';

// We use a simple PolySynth for now as a placeholder for real samplers.
const synth = new Tone.PolySynth(Tone.Synth).toDestination();

// It is good practice to set some basic effects like a slight reverb or release
synth.set({
  oscillator: { type: 'sine' },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 1,
  },
});

let isAudioInitialized = false;

export const playNote = async (pitch: string) => {
  if (!isAudioInitialized) {
    await Tone.start();
    isAudioInitialized = true;
  }
  
  // Play the note for 8n (an 8th note duration)
  synth.triggerAttackRelease(pitch, '8n');
};
