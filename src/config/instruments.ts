export interface DrumDef {
  pitch: string;
  label: string;
  color: number;
  /** Note index (0–11) used for piano roll lane mapping. 0=C, 2=D, 4=E, 5=F, 7=G … */
  pianoRollMidi: number;
  synthType: 'membrane' | 'noise';
  synthOptions: Record<string, unknown>;
  noiseType?: 'white' | 'pink';
  /** Only for membrane synths: the pitch passed to triggerAttackRelease */
  triggerPitch?: string;
}

export type MelodicSynthType = 'poly-synth' | 'poly-fm' | 'poly-mono' | 'poly-am';

export interface InstrumentDef {
  id: string;
  label: string;
  icon: string;
  /** MIDI program number range [min, max] used by midiImport to auto-detect instrument */
  midiNumberRange?: [number, number];
  /** Tone.js PolySynth variant. Omit for percussion / group_rect. */
  synthType?: MelodicSynthType;
  /** Options passed to PolySynth.set() after creation */
  synthOptions?: Record<string, unknown>;
  /** Octave shift applied to playback pitch (e.g. -2 drops bass 2 octaves) */
  octaveShift?: number;
}

// ─── Drum Registry ─────────────────────────────────────────────────────────────
// Add a new entry here to get a new drum type across the entire app.

export const DRUM_REGISTRY: DrumDef[] = [
  {
    pitch: 'kick',
    label: 'Kick',
    color: 0xef4444,
    pianoRollMidi: 0,
    synthType: 'membrane',
    triggerPitch: 'C1',
    synthOptions: { pitchDecay: 0.05, octaves: 6 },
  },
  {
    pitch: 'snare',
    label: 'Snare',
    color: 0x3b82f6,
    pianoRollMidi: 2,
    synthType: 'noise',
    noiseType: 'white',
    synthOptions: { envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 } },
  },
  {
    pitch: 'hihat',
    label: 'Hi-Hat',
    color: 0xf59e0b,
    pianoRollMidi: 4,
    synthType: 'noise',
    noiseType: 'pink',
    synthOptions: { envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.01 } },
  },
  {
    pitch: 'tom',
    label: 'Tom',
    color: 0x8b5cf6,
    pianoRollMidi: 5,
    synthType: 'membrane',
    triggerPitch: 'G2',
    synthOptions: { pitchDecay: 0.08, octaves: 5 },
  },
  {
    pitch: 'cymbal',
    label: 'Cymbal',
    color: 0x10b981,
    pianoRollMidi: 7,
    synthType: 'noise',
    noiseType: 'white',
    synthOptions: { envelope: { attack: 0.005, decay: 1.5, sustain: 0, release: 0.1 } },
  },
  // ── GM 常用補充 ──────────────────────────────────────────────
  {
    pitch: 'clap',
    label: 'Clap',
    color: 0xf97316,
    pianoRollMidi: 1,  // C#
    synthType: 'noise',
    noiseType: 'white',
    synthOptions: { envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 } },
  },
  {
    pitch: 'openhat',
    label: 'Open Hat',
    color: 0x84cc16,
    pianoRollMidi: 3,  // D#
    synthType: 'noise',
    noiseType: 'pink',
    synthOptions: { envelope: { attack: 0.001, decay: 0.3, sustain: 0.05, release: 0.4 } },
  },
  {
    pitch: 'ride',
    label: 'Ride',
    color: 0x06b6d4,
    pianoRollMidi: 6,  // F#
    synthType: 'noise',
    noiseType: 'white',
    synthOptions: { envelope: { attack: 0.003, decay: 0.8, sustain: 0, release: 0.3 } },
  },
  {
    pitch: 'floortom',
    label: 'Floor Tom',
    color: 0x6366f1,
    pianoRollMidi: 8,  // G#
    synthType: 'membrane',
    triggerPitch: 'C2',
    synthOptions: { pitchDecay: 0.1, octaves: 4 },
  },
];

// ─── Instrument Registry ────────────────────────────────────────────────────────
// Add a new entry here to get a new melodic instrument across the entire app.
// synthType controls which Tone.js PolySynth is used; synthOptions are passed to .set().
// Omit synthType for non-playable types (percussion, group_rect).

export const INSTRUMENT_REGISTRY: InstrumentDef[] = [
  {
    id: 'piano',
    label: 'Piano',
    icon: '🎹',
    synthType: 'poly-synth',
    synthOptions: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 1.2 },
    },
  },
  {
    id: 'epiano',
    label: 'E. Piano',
    icon: '🎵',
    midiNumberRange: [4, 7],
    synthType: 'poly-am',
    // AM modulation gives a warm, slightly bell-like character similar to Rhodes
    synthOptions: {
      harmonicity: 3.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 1.2 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 },
    },
  },
  {
    id: 'organ',
    label: 'Organ',
    icon: '🪗',
    midiNumberRange: [16, 23],
    synthType: 'poly-fm',
    // Square wave + full sustain + fast release ≈ Hammond-like drawbar organ
    synthOptions: {
      harmonicity: 2,
      modulationIndex: 1,
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.05 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.01, decay: 0, sustain: 1, release: 0.05 },
    },
  },
  {
    id: 'guitar',
    label: 'Guitar',
    icon: '🪕',
    midiNumberRange: [24, 31],
    synthType: 'poly-synth',
    // Short decay, low sustain = plucky character
    synthOptions: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 },
    },
  },
  {
    id: 'strings',
    label: 'Strings',
    icon: '🎻',
    midiNumberRange: [40, 47],
    synthType: 'poly-synth',
    // Slow attack sawtooth = bowed string ensemble feel
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.3, decay: 0.1, sustain: 0.8, release: 1.5 },
    },
  },
  {
    id: 'synth',
    label: 'Synth',
    icon: '📻',
    midiNumberRange: [80, 87],
    synthType: 'poly-fm',
    synthOptions: {
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 },
      modulation: { type: 'square' },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.5 },
    },
  },
  {
    id: 'bass',
    label: 'Bass',
    icon: '🎸',
    midiNumberRange: [32, 39],
    synthType: 'poly-mono',
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2, baseFrequency: 100, octaves: 4 },
    },
    octaveShift: -2,
  },
  { id: 'percussion', label: 'Percussion', icon: '🥁' },
  { id: 'group_rect',  label: 'Group',      icon: '🟩' },
];

// ─── Derived helpers ────────────────────────────────────────────────────────────

export const PERCUSSION_PITCHES = DRUM_REGISTRY.map(d => d.pitch);

export const getDrumByPitch = (pitch: string): DrumDef | undefined =>
  DRUM_REGISTRY.find(d => d.pitch === pitch);

export const getInstrumentById = (id: string): InstrumentDef | undefined =>
  INSTRUMENT_REGISTRY.find(i => i.id === id);

/** All instruments with a synthType — suitable for melodic keyboard selection */
export const MELODIC_INSTRUMENTS = INSTRUMENT_REGISTRY.filter(i => i.synthType);

/** 透過 MIDI Program Number 取得對應的樂器 ID */
export const getInstrumentByMidiProgram = (programNumber: number): string => {
  const found = INSTRUMENT_REGISTRY.find(i => {
    if (i.midiNumberRange) {
      return programNumber >= i.midiNumberRange[0] && programNumber <= i.midiNumberRange[1];
    }
    return false;
  });
  return found ? found.id : 'piano'; // 預設 Fallback 為鋼琴
};

/** 透過 MIDI Note Number 取得對應的打擊樂器 Pitch 名稱 (GM 標準鼓譜對應) */
export const getDrumPitchByMidiNote = (midiNote: number): string => {
  switch (midiNote) {
    case 35: case 36: return 'kick';        // 大鼓
    case 38: case 40: return 'snare';       // 小鼓
    case 39: return 'clap';                 // 拍手
    case 42: case 44: return 'hihat';       // 閉合 Hi-Hat / 踏板 Hi-Hat
    case 46: return 'openhat';              // 開放 Hi-Hat
    case 41: case 43: return 'floortom';    // 低音 Tom
    case 45: case 47: case 48: case 50: return 'tom'; // 中/高音 Tom
    case 49: case 55: case 57: return 'cymbal'; // 碎音鈸 (Crash)
    case 51: case 53: case 59: return 'ride';   // 節奏鈸 (Ride)
    default: return 'kick'; // 如果遇到不認識的打擊樂器，Fallback 為 kick
  }
};