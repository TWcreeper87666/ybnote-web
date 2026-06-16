import * as Tone from 'tone';

let limiter: Tone.Limiter;
let masterVolume: Tone.Volume;
let pianoSynth: Tone.PolySynth<Tone.Synth>;
let synthInstrument: Tone.PolySynth<Tone.FMSynth>;
let bassInstrument: Tone.PolySynth<Tone.MonoSynth>;
let kickSynth: Tone.PolySynth<Tone.MembraneSynth>;
let tomSynth: Tone.PolySynth<Tone.MembraneSynth>;

class DrumPool {
  synths: any[];
  index: number = 0;

  constructor(synthFactory: () => any, count: number = 4) {
    this.synths = Array.from({ length: count }, synthFactory);
  }

  connect(dest: Tone.InputNode) {
    this.synths.forEach(s => s.connect(dest));
    return this;
  }

  triggerAttackRelease(duration: any, time?: any, velocity?: any) {
    const s = this.synths[this.index];
    this.index = (this.index + 1) % this.synths.length;
    s.triggerAttackRelease(duration, time, velocity);
  }
}

let snareSynth: DrumPool;
let hihatSynth: DrumPool;
let cymbalSynth: DrumPool;

let isAudioInitialized = false;

const initAudio = () => {
  if (isAudioInitialized) return;
  
  // 1. & 2. Create Limiter and Master Volume to prevent clipping
  limiter = new Tone.Limiter(-2).toDestination();
  masterVolume = new Tone.Volume(-8).connect(limiter);

  // Use Synthesized Piano instead of Sampler to avoid network requests and connection resets
  pianoSynth = new Tone.PolySynth(Tone.Synth).connect(masterVolume);
  pianoSynth.set({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.01,
      decay: 0.5,
      sustain: 0.2,
      release: 1.2,
    },
  });

  // Additional Instruments
  synthInstrument = new Tone.PolySynth<Tone.FMSynth>(Tone.FMSynth).connect(masterVolume);
  synthInstrument.set({
    harmonicity: 3,
    modulationIndex: 10,
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 },
    modulation: { type: "square" },
    modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 }
  });

  bassInstrument = new Tone.PolySynth<Tone.MonoSynth>(Tone.MonoSynth).connect(masterVolume);
  bassInstrument.set({
    oscillator: { type: "sawtooth" },
    filter: { Q: 2, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2, baseFrequency: 100, octaves: 4 }
  });

  kickSynth = new Tone.PolySynth<Tone.MembraneSynth>(Tone.MembraneSynth).connect(masterVolume);
  tomSynth = new Tone.PolySynth<Tone.MembraneSynth>(Tone.MembraneSynth).connect(masterVolume);

  snareSynth = new DrumPool(() => new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
  })).connect(masterVolume);
  
  hihatSynth = new DrumPool(() => new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.01 }
  })).connect(masterVolume);
  
  cymbalSynth = new DrumPool(() => new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 1.5, sustain: 0, release: 0.1 }
  })).connect(masterVolume);

  isAudioInitialized = true;
};

// Attempt to keep audio context alive when returning to the page
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isAudioInitialized) {
      if (Tone.context.state !== 'running') {
        Tone.context.resume();
      }
    }
  });

  window.addEventListener('pointerdown', () => {
    if (isAudioInitialized && Tone.context.state !== 'running') {
      Tone.context.resume();
    }
  }, { capture: true });
}

export const playNote = async (pitch: string, volume: number = 1.0, instrument: string = 'piano') => {
  if (!isAudioInitialized) {
    await Tone.start();
    initAudio();
  } else if (Tone.context.state !== 'running') {
    Tone.context.resume();
  }
  
  // Volume usually ranges from 0 to 1, we can map it to velocity.
  const velocity = Math.max(0, Math.min(1, volume));
  
  if (instrument === 'percussion') {
    const note = pitch.replace(/[0-9]/g, '');
    if (pitch === 'kick' || note === 'C') {
      kickSynth.triggerAttackRelease('C1', '8n', Tone.now(), velocity);
    } else if (pitch === 'snare' || note === 'D') {
      snareSynth.triggerAttackRelease('8n', Tone.now(), velocity);
    } else if (pitch === 'hihat' || note === 'E') {
      hihatSynth.triggerAttackRelease('8n', Tone.now(), velocity);
    } else if (pitch === 'tom' || note === 'F') {
      tomSynth.triggerAttackRelease('G2', '8n', Tone.now(), velocity);
    } else if (pitch === 'cymbal' || note === 'G') {
      cymbalSynth.triggerAttackRelease('8n', Tone.now(), velocity);
    } else {
      hihatSynth.triggerAttackRelease('8n', Tone.now(), velocity);
    }
    return;
  }

  // Adjust pitch for bass to make it actually sound like a bass even if written in C4
  let playPitch = pitch;
  if (instrument === 'bass') {
    // shift down 1 or 2 octaves if it's 4 or higher, just an easy trick
    const octaveMatch = pitch.match(/\d/);
    if (octaveMatch) {
      const octave = parseInt(octaveMatch[0], 10);
      playPitch = pitch.replace(/\d/, Math.max(1, octave - 2).toString());
    }
  }

  const activeSynth = instrument === 'synth' ? synthInstrument 
                    : instrument === 'bass' ? bassInstrument
                    : null;

  if (activeSynth) {
    activeSynth.triggerAttackRelease(playPitch, '8n', Tone.now(), velocity);
  } else {
    // Default to piano synth
    pianoSynth.triggerAttackRelease(playPitch, '8n', Tone.now(), velocity);
  }
};
