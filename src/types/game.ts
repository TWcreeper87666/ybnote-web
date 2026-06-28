export interface Block {
  id: string;
  x: number;
  y: number;
  pitch: string; // e.g., 'C4', 'D#4'
  instrument: string; // e.g., 'piano'
  volume?: number; // 0.0 to 1.0
  keyBinding?: string; // Key to trigger this block
  groupId?: string; // ID of the group this block belongs to
  playedAt?: number; // Timestamp of last play for animation
  playedVolumeMultiplier?: number; // Multiplier to use when playing this block
  playedPitchOffset?: number; // Semitone offset applied at play time (from group rect)
  xOffset?: number; // for pocket canvas layout
  yOffset?: number; // for pocket canvas layout
  originalTime?: number; // for pocket canvas layout sorting
  midiNumber?: number; // for pocket canvas layout sorting
}

export interface Group {
  id: string;
  name: string;
}

export interface GroupRect {
  id: string;
  name?: string; // Optional custom name
  x: number;
  y: number;
  w: number;
  h: number;
  playedAt?: number;
  volume?: number; // 0.0 to 1.0, master volume for group
  keyBinding?: string;
  enabled?: boolean;
  groupId?: string;
  pitchOffset: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface TrackNode {
  id: string;
  x: number;
  y: number;
}

export interface Track {
  id: string;
  name?: string;
  nodes: TrackNode[];
  bpm: number;
  loop: boolean | 'restart';
  enabled?: boolean;
  groupId?: string;
}

export interface Runner {
  id: string;
  trackId: string;
  progress: number;
}

export type Theme = 'light' | 'dark';
export type Mode = 'select' | 'draw_track' | 'piano' | 'drum' | 'draw_group' | 'play';

export interface HitEvent {
  type: 'Perfect' | 'Good' | 'Bad' | 'Miss' | 'Wrong';
  offset: number; // in ms
  time: number; // Date.now() timestamp
  color: number;
}
