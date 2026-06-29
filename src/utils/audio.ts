import * as Tone from "tone";
import { DRUM_REGISTRY, INSTRUMENT_REGISTRY } from "../config/instruments";

let compressor: Tone.Compressor;
let masterVolume: Tone.Volume;

// Maps instrument id → PolySynth, built dynamically from INSTRUMENT_REGISTRY
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const melodicSynths = new Map<string, Tone.PolySynth<any>>();

class DrumPool {
  synths: Tone.NoiseSynth[];
  index: number = 0;

  constructor(
    noiseType: "white" | "pink",
    options: Record<string, unknown>,
    count: number = 4,
  ) {
    this.synths = Array.from(
      { length: count },
      () =>
        new Tone.NoiseSynth({
          noise: { type: noiseType },
          ...options,
        } as Tone.NoiseSynthOptions),
    );
  }

  connect(dest: Tone.InputNode) {
    this.synths.forEach((s) => s.connect(dest));
    return this;
  }

  triggerAttackRelease(
    duration: string | number,
    time?: number | string,
    velocity?: number,
  ) {
    const s = this.synths[this.index];
    this.index = (this.index + 1) % this.synths.length;
    s.triggerAttackRelease(duration, time, velocity);
  }
}

// Maps drum pitch string → trigger function, built dynamically from DRUM_REGISTRY
const drumTriggers = new Map<string, (velocity: number) => void>();
// Maps piano-roll note name (e.g. 'C', 'D') → drum pitch string, for MIDI-style input
const noteNameToDrum = new Map<string, string>();

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

let isAudioInitialized = false;

const initAudio = () => {
  if (isAudioInitialized) return;

  // 1. & 2. Create Compressor, Limiter and Master Volume to prevent clipping and handle high polyphony
  compressor = new Tone.Compressor({
    threshold: -24,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
  });

  const limiter = new Tone.Limiter(-2).toDestination();
  compressor.connect(limiter);

  masterVolume = new Tone.Volume(-12).connect(compressor);

  // Build melodic synths dynamically from INSTRUMENT_REGISTRY
  INSTRUMENT_REGISTRY.forEach((instr) => {
    if (!instr.synthType) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let synth: Tone.PolySynth<any>;
    switch (instr.synthType) {
      case "poly-fm":
        synth = new Tone.PolySynth(Tone.FMSynth);
        break;
      case "poly-mono":
        synth = new Tone.PolySynth(Tone.MonoSynth);
        break;
      case "poly-am":
        synth = new Tone.PolySynth(Tone.AMSynth);
        break;
      default:
        synth = new Tone.PolySynth(Tone.Synth);
        break;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (instr.synthOptions) synth.set(instr.synthOptions as any);
    synth.connect(masterVolume);
    melodicSynths.set(instr.id, synth);
  });

  // Build drum synths dynamically from DRUM_REGISTRY
  DRUM_REGISTRY.forEach((drum) => {
    let trigger: (velocity: number) => void;
    if (drum.synthType === "membrane") {
      const synth = new Tone.PolySynth(
        Tone.MembraneSynth,
        drum.synthOptions as unknown as Tone.MembraneSynthOptions,
      ).connect(masterVolume);
      const pitch = drum.triggerPitch!;
      trigger = (velocity) =>
        synth.triggerAttackRelease(pitch, "8n", Tone.now(), velocity);
    } else {
      const pool = new DrumPool(drum.noiseType!, drum.synthOptions).connect(
        masterVolume,
      );
      trigger = (velocity) =>
        pool.triggerAttackRelease("8n", Tone.now(), velocity);
    }
    drumTriggers.set(drum.pitch, trigger);
    noteNameToDrum.set(NOTE_NAMES[drum.pianoRollMidi], drum.pitch);
  });

  // Prevent browser from suspending AudioContext after a period of inactivity
  const silentOsc = new Tone.Oscillator().start();
  const silentGain = new Tone.Gain(0).toDestination();
  silentOsc.connect(silentGain);

  isAudioInitialized = true;
};

export const setMasterVolume = (volume: number) => {
  if (!masterVolume) return;
  // Convert 0-1 linear volume to decibels (-60 to 0)
  // Or just a simple curve:
  if (volume <= 0.01) {
    masterVolume.volume.value = -Infinity;
  } else {
    // 1.0 -> 0dB, 0.5 -> ~ -6dB, 0.1 -> ~ -20dB
    masterVolume.volume.value = 20 * Math.log10(volume);
  }
};

// Attempt to keep audio context alive when returning to the page
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isAudioInitialized) {
      if (Tone.getContext().state !== "running") {
        Tone.getContext().resume();
      }
    }
  });

  window.addEventListener(
    "pointerdown",
    () => {
      if (isAudioInitialized && Tone.getContext().state !== "running") {
        Tone.getContext().resume();
      }
    },
    { capture: true },
  );
}

export const playNote = async (
  pitch: string,
  volume: number = 1.0,
  instrument: string = "piano",
) => {
  if (!isAudioInitialized) {
    await Tone.start();
    initAudio();
  } else if (Tone.getContext().state !== "running") {
    await Tone.getContext().resume();
  }

  // Volume usually ranges from 0 to 1, we can map it to velocity.
  const velocity = Math.max(0, Math.min(1, volume));

  if (instrument === "percussion") {
    // Resolve piano-roll note names (e.g. 'C4' → 'kick') or use pitch directly
    const noteName = pitch.replace(/[0-9]/g, "");
    const resolvedPitch = drumTriggers.has(pitch)
      ? pitch
      : (noteNameToDrum.get(noteName) ?? "hihat");
    drumTriggers.get(resolvedPitch)?.(velocity);
    return;
  }

  // Apply octave shift if defined (e.g. bass drops 2 octaves)
  let playPitch = pitch;
  const instrDef = INSTRUMENT_REGISTRY.find((i) => i.id === instrument);
  if (instrDef?.octaveShift) {
    const octaveMatch = pitch.match(/\d/);
    if (octaveMatch) {
      const octave = parseInt(octaveMatch[0], 10);
      playPitch = pitch.replace(
        /\d/,
        Math.max(1, octave + instrDef.octaveShift).toString(),
      );
    }
  }

  const synth = melodicSynths.get(instrument) ?? melodicSynths.get("piano");
  synth?.triggerAttackRelease(playPitch, "8n", Tone.now(), velocity);
};
