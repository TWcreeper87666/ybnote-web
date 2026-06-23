export interface EditorNote {
  id: string;
  pitch: number;      // MIDI note number 0-127
  name: string;       // e.g. 'C4', 'D#5'
  timeStart: number;  // seconds
  duration: number;   // seconds
  velocity: number;   // 0-1
  targetId?: string;
  targetType?: 'block' | 'groupRect';
}

export interface EditorTrack {
  id: number;
  name: string;
  notes: EditorNote[];
  instrument: string;
  isBackground?: boolean;
}

export interface ParsedMidiData {
  bpm: number;
  duration: number;
  tracks: EditorTrack[];
}

export interface RecordedHit {
  time: number; // raw hit time relative to playback
  blockId: string;
  blockType: 'block' | 'groupRect';
}

export interface MatchResult {
  matchedNotes: Array<{
    note: EditorNote;
    hit: RecordedHit;
    hitType: 'Perfect' | 'Good' | 'Bad';
    offsetMs: number;
    trackId: number;
  }>;
  missedNotes: Array<{ note: EditorNote; trackId: number }>;
  wrongHits: RecordedHit[];
  stats: {
    score: number;
    maxCombo: number;
    perfects: number;
    goods: number;
    bads: number;
    misses: number;
    wrongs: number;
  };
}
