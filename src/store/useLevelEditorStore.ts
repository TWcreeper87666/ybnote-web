import { create } from 'zustand';

// --- Types ---
export interface EditorNote {
  id: string;
  pitch: number;      // MIDI note number 0-127
  name: string;       // e.g. 'C4', 'D#5'
  timeStart: number;  // seconds
  duration: number;   // seconds
  velocity: number;   // 0-1
}

export interface EditorTrack {
  id: number;
  name: string;
  notes: EditorNote[];
  instrument: string;
}

export interface ParsedMidiData {
  bpm: number;
  duration: number;
  tracks: EditorTrack[];
}

// --- History ---
interface HistorySnapshot {
  notes: EditorNote[];
  selectedNoteIds: string[];
  chartEndPosition?: number;
}

interface LevelEditorState {
  // Audio
  audioFile: File | null;
  audioBuffer: AudioBuffer | null;
  audioUrl: string | null;
  trimStart: number;
  trimEnd: number;
  audioVolume: number;
  audioPlaybackRate: number;
  audioStartTime: number;
  audioDuration: number;

  // MIDI / Project
  bpm: number;
  offset: number;        // ms offset for audio sync
  midiData: ParsedMidiData | null;
  selectedTrackId: number | null;
  midiVolume: number;
  instrumentPreset: string;

  // Track state mappings
  ghostNoteVisibility: Record<number, boolean>;
  trackMute: Record<number, boolean>;

  // Piano Roll viewport
  zoomLevel: number;     // px per second
  scrollLeft: number;
  scrollTop: number;
  showVelocityTab: boolean;

  // Playback
  playbackPosition: number;
  playbackAnchor: number;
  isPlaying: boolean;
  chartEndPosition: number;

  // Selection
  selectedNoteIds: Set<string>;

  // History
  history: HistorySnapshot[];
  historyIndex: number;
  clipboard: EditorNote[];
  clipboardSourceTrackId: number | null;

  // Tab
  activeTab: 'pianoroll' | 'blocks';

  // Actions — Audio
  setAudioFile: (file: File, buffer: AudioBuffer, url: string) => void;
  setTrimStart: (t: number) => void;
  setTrimEnd: (t: number) => void;
  setAudioVolume: (v: number) => void;
  setAudioPlaybackRate: (v: number) => void;
  setAudioStartTime: (v: number) => void;

  // Actions — MIDI & Tracks
  setMidiData: (data: ParsedMidiData) => void;
  setBpm: (bpm: number) => void;
  setOffset: (offset: number) => void;
  setMidiVolume: (v: number) => void;
  setInstrumentPreset: (v: string) => void;
  
  selectTrack: (id: number | null) => void;
  addTrack: () => void;
  duplicateTrack: (id: number) => void;
  removeTrack: (id: number) => void;
  renameTrack: (id: number, name: string) => void;
  updateTrackInstrument: (id: number, instrument: string) => void;
  toggleTrackMute: (id: number) => void;
  toggleGhostNotes: (id: number) => void;

  // Actions — Viewport
  setZoomLevel: (level: number, anchorPhysicalX?: number) => void;
  setScrollLeft: (val: number) => void;
  setScrollTop: (val: number) => void;
  setShowVelocityTab: (v: boolean) => void;

  // Actions — Playback
  setPlaybackPosition: (pos: number) => void;
  setPlaybackAnchor: (time: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  setChartEndPosition: (pos: number) => void;

  // Actions — Notes
  getCurrentTrack: () => EditorTrack | null;
  addNote: (note: EditorNote) => void;
  removeNote: (noteId: string) => void;
  removeSelectedNotes: () => void;
  updateNotes: (updates: { id: string; changes: Partial<EditorNote> }[], commit?: boolean) => void;

  // Actions — Selection
  selectNote: (noteId: string, multi?: boolean) => void;
  deselectNote: (noteId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Actions — History
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Actions — Clipboard
  copySelectedNotes: () => void;
  pasteNotes: (pasteTime?: number) => void;

  // Actions — Tab
  setActiveTab: (tab: 'pianoroll' | 'blocks') => void;

  // Actions — Reset
  reset: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
let nextTrackIdObj = 0;

export const useLevelEditorStore = create<LevelEditorState>()((set, get) => ({
  // Initial state
  audioFile: null,
  audioBuffer: null,
  audioUrl: null,
  trimStart: 0,
  trimEnd: 0,
  audioVolume: 80,
  audioPlaybackRate: 1.0,
  audioStartTime: 0,
  audioDuration: 0,

  bpm: 120,
  offset: 0,
  midiData: null,
  selectedTrackId: null,
  midiVolume: 80,
  instrumentPreset: 'piano',

  ghostNoteVisibility: {},
  trackMute: {},

  zoomLevel: 100,
  scrollLeft: 0,
  scrollTop: 800,
  showVelocityTab: true,

  playbackPosition: 0,
  playbackAnchor: 0,
  isPlaying: false,
  chartEndPosition: 60,

  selectedNoteIds: new Set(),

  history: [],
  historyIndex: -1,
  clipboard: [],
  clipboardSourceTrackId: null,

  activeTab: 'pianoroll',

  // --- Audio actions ---
  setAudioFile: (file, buffer, url) => {
    const prev = get().audioUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ audioFile: file, audioBuffer: buffer, audioUrl: url, trimEnd: buffer.duration, audioDuration: buffer.duration });
  },
  setTrimStart: (t) => set({ trimStart: t }),
  setTrimEnd: (t) => set({ trimEnd: t }),
  setAudioVolume: (v) => set({ audioVolume: v }),
  setAudioPlaybackRate: (v) => set({ audioPlaybackRate: v }),
  setAudioStartTime: (v) => set({ audioStartTime: v }),

  // --- MIDI actions ---
  setMidiData: (data) => {
    // Reset next track ID based on imported data
    nextTrackIdObj = Math.max(0, ...data.tracks.map(t => t.id)) + 1;
    
    set({
      midiData: data,
      bpm: data.bpm,
      chartEndPosition: data.duration || 60,
      selectedTrackId: data.tracks.length > 0 ? data.tracks[0].id : null,
      selectedNoteIds: new Set(),
      history: [],
      historyIndex: -1,
      ghostNoteVisibility: {},
      trackMute: {}
    });
    get().commitHistory();
  },
  setBpm: (bpm) => set({ bpm }),
  setOffset: (offset) => set({ offset }),
  setMidiVolume: (v) => set({ midiVolume: v }),
  setInstrumentPreset: (v) => set({ instrumentPreset: v }),

  // --- Track Management ---
  selectTrack: (id) => {
    set({ selectedTrackId: id, selectedNoteIds: new Set(), history: [], historyIndex: -1 });
    get().commitHistory();
  },
  addTrack: () => {
    const s = get();
    let currentMidiData = s.midiData;
    
    if (!currentMidiData) {
      currentMidiData = {
        bpm: s.bpm || 120,
        duration: s.audioDuration || 60,
        tracks: []
      };
      nextTrackIdObj = 0;
    }

    const newTrackId = nextTrackIdObj++;
    const newTrack: EditorTrack = {
      id: newTrackId,
      name: `Track ${newTrackId + 1}`,
      notes: [],
      instrument: 'piano'
    };
    currentMidiData.tracks.push(newTrack);
    set({ midiData: { ...currentMidiData } });
    get().selectTrack(newTrackId);
  },
  duplicateTrack: (id) => {
    const s = get();
    if (!s.midiData) return;
    const trackToDup = s.midiData.tracks.find(t => t.id === id);
    if (!trackToDup) return;
    
    const newTrackId = nextTrackIdObj++;
    const dupNotes = JSON.parse(JSON.stringify(trackToDup.notes)).map((n: EditorNote) => ({
      ...n,
      id: generateId()
    }));
    
    const newTrack: EditorTrack = {
      id: newTrackId,
      name: `${trackToDup.name} (Copy)`,
      notes: dupNotes,
      instrument: trackToDup.instrument
    };
    
    const index = s.midiData.tracks.findIndex(t => t.id === id);
    s.midiData.tracks.splice(index + 1, 0, newTrack);
    set({ midiData: { ...s.midiData } });
    get().selectTrack(newTrackId);
  },
  removeTrack: (id) => {
    const s = get();
    if (!s.midiData) return;
    s.midiData.tracks = s.midiData.tracks.filter(t => t.id !== id);
    
    let newSelectedId = s.selectedTrackId;
    if (newSelectedId === id) {
      newSelectedId = s.midiData.tracks.length > 0 ? s.midiData.tracks[0].id : null;
    }
    set({ midiData: { ...s.midiData } });
    get().selectTrack(newSelectedId);
  },
  renameTrack: (id, name) => {
    const s = get();
    if (!s.midiData) return;
    const track = s.midiData.tracks.find(t => t.id === id);
    if (track) {
      track.name = name;
      set({ midiData: { ...s.midiData } });
    }
  },
  updateTrackInstrument: (id, instrument) => {
    const s = get();
    if (!s.midiData) return;
    const track = s.midiData.tracks.find(t => t.id === id);
    if (track) {
      track.instrument = instrument;
      set({ midiData: { ...s.midiData } });
    }
  },
  toggleTrackMute: (id) => set((s) => ({
    trackMute: { ...s.trackMute, [id]: !s.trackMute[id] }
  })),
  toggleGhostNotes: (id) => set((s) => ({
    ghostNoteVisibility: { ...s.ghostNoteVisibility, [id]: !s.ghostNoteVisibility[id] }
  })),

  // --- Viewport actions ---
  setZoomLevel: (level, anchorPhysicalX = 0) => {
    const state = get();
    if (level === state.zoomLevel) return;
    const anchorTime = (state.scrollLeft + anchorPhysicalX) / state.zoomLevel;
    set({
      zoomLevel: level,
      scrollLeft: Math.max(0, anchorTime * level - anchorPhysicalX),
    });
  },
  setScrollLeft: (val) => set({ scrollLeft: Math.max(0, val) }),
  setScrollTop: (val) => set({ scrollTop: Math.max(0, val) }),
  setShowVelocityTab: (v) => set({ showVelocityTab: v }),

  // --- Playback actions ---
  setPlaybackPosition: (pos) => set({ playbackPosition: pos }),
  setPlaybackAnchor: (time) => {
    const t = Math.max(0, time);
    set((s) => ({ playbackAnchor: t, playbackPosition: s.isPlaying ? s.playbackPosition : t }));
  },
  togglePlayback: () => set((s) => {
    if (s.isPlaying) {
      return { isPlaying: false, playbackPosition: s.playbackAnchor };
    }
    return { isPlaying: true, playbackPosition: s.playbackAnchor };
  }),
  stopPlayback: () => set((s) => ({ isPlaying: false, playbackPosition: s.playbackAnchor })),
  setChartEndPosition: (pos: number) => set({ chartEndPosition: Math.max(0, pos) }),

  // --- Note helpers ---
  getCurrentTrack: () => {
    const s = get();
    if (!s.midiData || s.selectedTrackId === null) return null;
    return s.midiData.tracks.find(t => t.id === s.selectedTrackId) || null;
  },

  addNote: (note) => {
    const track = get().getCurrentTrack();
    if (!track) return;
    track.notes.push(note);
    set({ midiData: { ...get().midiData! } });
    get().commitHistory();
  },

  removeNote: (noteId) => {
    const s = get();
    const track = s.getCurrentTrack();
    if (!track) return;
    track.notes = track.notes.filter(n => n.id !== noteId);
    const newSel = new Set(s.selectedNoteIds);
    newSel.delete(noteId);
    set({ midiData: { ...s.midiData! }, selectedNoteIds: newSel });
  },

  removeSelectedNotes: () => {
    const s = get();
    const track = s.getCurrentTrack();
    if (!track || s.selectedNoteIds.size === 0) return;
    track.notes = track.notes.filter(n => !s.selectedNoteIds.has(n.id));
    set({ midiData: { ...s.midiData! }, selectedNoteIds: new Set() });
    get().commitHistory();
  },

  updateNotes: (updates, commit = true) => {
    const s = get();
    const track = s.getCurrentTrack();
    if (!track) return;
    for (const u of updates) {
      const note = track.notes.find(n => n.id === u.id);
      if (note) Object.assign(note, u.changes);
    }
    set({ midiData: { ...s.midiData! } });
    if (commit) get().commitHistory();
  },

  // --- Selection actions ---
  selectNote: (noteId, multi = false) => set((s) => {
    if (multi) {
      const newSet = new Set(s.selectedNoteIds);
      newSet.add(noteId);
      return { selectedNoteIds: newSet };
    }
    return { selectedNoteIds: new Set([noteId]) };
  }),
  deselectNote: (noteId) => set((s) => {
    const newSet = new Set(s.selectedNoteIds);
    newSet.delete(noteId);
    return { selectedNoteIds: newSet };
  }),
  selectAll: () => {
    const track = get().getCurrentTrack();
    if (track) {
      set({ selectedNoteIds: new Set(track.notes.map(n => n.id)) });
    }
  },
  clearSelection: () => set({ selectedNoteIds: new Set() }),

  // --- History ---
  commitHistory: () => {
    const s = get();
    const track = s.getCurrentTrack();
    if (!track) return;
    const snapshot: HistorySnapshot = {
      notes: JSON.parse(JSON.stringify(track.notes)),
      selectedNoteIds: Array.from(s.selectedNoteIds),
      chartEndPosition: s.chartEndPosition,
    };
    const newHistory = s.history.slice(0, s.historyIndex + 1);
    newHistory.push(snapshot);
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0 || !s.midiData || s.selectedTrackId === null) return;
    const newIndex = s.historyIndex - 1;
    const snapshot = s.history[newIndex];
    const track = s.midiData.tracks.find(t => t.id === s.selectedTrackId);
    if (!track) return;
    track.notes = JSON.parse(JSON.stringify(snapshot.notes));
    set({
      midiData: { ...s.midiData },
      historyIndex: newIndex,
      selectedNoteIds: new Set(snapshot.selectedNoteIds),
      ...(snapshot.chartEndPosition !== undefined && { chartEndPosition: snapshot.chartEndPosition }),
    });
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1 || !s.midiData || s.selectedTrackId === null) return;
    const newIndex = s.historyIndex + 1;
    const snapshot = s.history[newIndex];
    const track = s.midiData.tracks.find(t => t.id === s.selectedTrackId);
    if (!track) return;
    track.notes = JSON.parse(JSON.stringify(snapshot.notes));
    set({
      midiData: { ...s.midiData },
      historyIndex: newIndex,
      selectedNoteIds: new Set(snapshot.selectedNoteIds),
      ...(snapshot.chartEndPosition !== undefined && { chartEndPosition: snapshot.chartEndPosition }),
    });
  },

  // --- Clipboard ---
  copySelectedNotes: () => {
    const s = get();
    const track = s.getCurrentTrack();
    if (!track || s.selectedNoteIds.size === 0) return;
    const selected = track.notes.filter(n => s.selectedNoteIds.has(n.id));
    set({ 
      clipboard: JSON.parse(JSON.stringify(selected)),
      clipboardSourceTrackId: track.id
    });
  },

  pasteNotes: (pasteTime) => {
    const s = get();
    if (!s.midiData || s.clipboard.length === 0) return;
    const track = s.getCurrentTrack();
    if (!track) return;
    
    const minTime = Math.min(...s.clipboard.map(n => n.timeStart));
    const offset = pasteTime !== undefined ? pasteTime - minTime : 0;
    const newNotes = s.clipboard.map(n => ({
      ...n,
      id: generateId(),
      timeStart: n.timeStart + offset,
    }));
    track.notes.push(...newNotes);
    set({
      midiData: { ...s.midiData },
      selectedNoteIds: new Set(newNotes.map(n => n.id)),
    });
    get().commitHistory();
  },

  // --- Tab ---
  setActiveTab: (tab) => set({ activeTab: tab }),

  // --- Reset ---
  reset: () => {
    const prev = get().audioUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      audioFile: null, audioBuffer: null, audioUrl: null,
      trimStart: 0, trimEnd: 0, audioVolume: 80, audioPlaybackRate: 1.0,
      audioStartTime: 0, audioDuration: 0,
      bpm: 120, offset: 0, midiData: null, selectedTrackId: null,
      midiVolume: 80, instrumentPreset: 'piano',
      ghostNoteVisibility: {}, trackMute: {},
      zoomLevel: 100, scrollLeft: 0, scrollTop: 800, showVelocityTab: true,
      playbackPosition: 0, playbackAnchor: 0, isPlaying: false, chartEndPosition: 60,
      selectedNoteIds: new Set(),
      history: [], historyIndex: -1, clipboard: [], clipboardSourceTrackId: null,
      activeTab: 'pianoroll',
    });
  },
}));
