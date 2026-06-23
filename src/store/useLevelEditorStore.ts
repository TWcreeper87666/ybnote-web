import { create } from 'zustand';
import { sliceAudioBuffer, encodeToMp3 } from '../utils/levelUtils';
import { syncGameEventsFromMidi, applyMatchResult, matchRecordedHits, syncCanvasToGameBlocks, type RecordedHit } from '../utils/chartUtils';
import { useStore } from './useStore';

import type { EditorNote, EditorTrack, ParsedMidiData, Block } from '../types';

// --- History ---
interface HistorySnapshot {
  tracks: EditorTrack[];
  selectedTrackId: number | null;
  selectedNoteIds: string[];
  chartEndPosition?: number;
  audioStartTime?: number;
  playbackAnchor?: number;
  bpm?: number;
  gameBlocks?: Block[];
  gameEvents?: { time: number; pitch: string; instrument: string; blockId: string; }[];
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
  levelTitle: string;
  levelAuthor: string;
  levelDescription: string;
  levelMidiCredit: string;
  levelMusicCredit: string;
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
  activeTab: 'pianoroll' | 'blocks' | 'charting';

  // Charting Tab state
  chartingNoteIndex: number;
  chartingPaused: boolean;
  chartingAutoSkipAssigned: boolean;
  chartingAwaitingPick: boolean;
  chartingHighlightIds: string[];

  // Record Mode state
  isRecordingChart: boolean;
  recordedChartHits: RecordedHit[];
  recordMatchPreview: import('../utils/chartUtils').MatchResult | null;

  // Actions — Audio
  setAudioFile: (file: File, buffer: AudioBuffer, url: string) => void;
  setTrimStart: (t: number) => void;
  setTrimEnd: (t: number) => void;
  setAudioVolume: (v: number) => void;
  setAudioPlaybackRate: (v: number) => void;
  setAudioStartTime: (v: number) => void;
  removeAudio: () => void;
  trimAudioInPlace: (mode: 'start' | 'end') => Promise<void>;

  // Actions — MIDI & Tracks
  setMidiData: (data: ParsedMidiData) => void;
  appendMidiData: (data: ParsedMidiData) => void;
  setBpm: (bpm: number) => void;
  setOffset: (offset: number) => void;
  setLevelMetadata: (metadata: Partial<{ levelTitle: string; levelAuthor: string; levelDescription: string; levelMidiCredit: string; levelMusicCredit: string; }>) => void;
  setMidiVolume: (v: number) => void;
  setInstrumentPreset: (v: string) => void;
  
  selectTrack: (id: number | null) => void;
  addTrack: () => void;
  duplicateTrack: (id: number) => void;
  removeTrack: (id: number) => void;
  renameTrack: (id: number, name: string) => void;
  updateTrackInstrument: (id: number, instrument: string) => void;
  toggleTrackBackground: (id: number) => void;
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
  addNote: (note: EditorNote, commit?: boolean) => void;
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
  setActiveTab: (tab: 'pianoroll' | 'blocks' | 'charting') => void;

  // Actions — Charting
  setChartingNoteIndex: (index: number) => void;
  setChartingPaused: (paused: boolean) => void;
  setChartingAutoSkipAssigned: (v: boolean) => void;
  setChartingAwaitingPick: (v: boolean) => void;
  setChartingHighlightIds: (ids: string[]) => void;
  assignNoteTarget: (noteId: string, trackId: number, targetId: string, targetType: 'block' | 'groupRect') => void;
  clearNoteTarget: (noteId: string, trackId: number) => void;
  startChartRecording: () => void;
  stopChartRecording: () => void;
  recordChartHit: (blockId: string, blockType: 'block' | 'groupRect') => void;
  discardChartRecording: () => void;
  setRecordMatchPreview: (preview: import('../utils/chartUtils').MatchResult | null) => void;
  applyRecordMatch: () => void;

  // Actions — Reset
  reset: () => void;

  // History config
  historyLimit: number;
  setHistoryLimit: (limit: number) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
let nextTrackIdObj = 1;

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
  levelTitle: '',
  levelAuthor: '',
  levelDescription: '',
  levelMidiCredit: '',
  levelMusicCredit: '',
  midiData: {
    bpm: 120,
    duration: 60,
    tracks: [{
      id: 0,
      name: 'Track 1',
      notes: [],
      instrument: 'piano'
    }]
  },
  selectedTrackId: 0,
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

  history: [{
    tracks: [{
      id: 0,
      name: 'Track 1',
      notes: [],
      instrument: 'piano'
    }],
    selectedTrackId: 0,
    selectedNoteIds: [],
    chartEndPosition: 60,
    audioStartTime: 0,
    playbackAnchor: 0,
    bpm: 120,
    gameBlocks: [],
    gameEvents: []
  }],
  historyIndex: 0,
  historyLimit: 50,
  clipboard: [],
  clipboardSourceTrackId: null,

  activeTab: 'pianoroll' as const,

  chartingNoteIndex: 0,
  chartingPaused: false,
  chartingAutoSkipAssigned: true,
  chartingAwaitingPick: false,
  chartingHighlightIds: [],

  isRecordingChart: false,
  recordedChartHits: [],
  recordMatchPreview: null,

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
  removeAudio: () => {
    const prev = get().audioUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ audioFile: null, audioBuffer: null, audioUrl: null, audioDuration: 0 });
  },
  trimAudioInPlace: async (mode) => {
    const s = get();
    if (!s.audioBuffer || !s.midiData) return;
    
    if (s.isPlaying) {
      get().stopPlayback();
    }
    
    // Determine trim points based on anchor
    const anchor = s.playbackAnchor;
    const targetAudioTime = anchor - s.audioStartTime;
    if (targetAudioTime < 0 || targetAudioTime > s.audioDuration) return; // playhead not over audio

    let newTrimStart = 0;
    let newTrimEnd = s.audioDuration;

    if (mode === 'start') {
      newTrimStart = targetAudioTime;
    } else {
      newTrimEnd = targetAudioTime;
    }

    if (newTrimStart >= newTrimEnd) return; // Invalid trim

    // Slice buffer
    const ctx = new AudioContext();
    const newBuffer = sliceAudioBuffer(ctx, s.audioBuffer, newTrimStart, newTrimEnd);
    const newBlob = encodeToMp3(newBuffer, 128);
    const newFile = new File([newBlob], 'audio.mp3', { type: 'audio/mp3' });
    const newUrl = URL.createObjectURL(newBlob);
    ctx.close();

    const prev = s.audioUrl;
    if (prev) URL.revokeObjectURL(prev);

    let newAudioStartTime = s.audioStartTime;
    let shiftAmount = 0;
    let newMidiData = s.midiData;

    if (mode === 'start') {
      newAudioStartTime = anchor;
      
      let hasNotesBefore = false;
      if (s.midiData) {
        hasNotesBefore = s.midiData.tracks.some(track => track.notes.some(note => note.timeStart < anchor - 0.001));
      }
      
      if (!hasNotesBefore && s.midiData) {
        shiftAmount = anchor;
        newAudioStartTime = 0;
        
        newMidiData = {
          ...s.midiData,
          tracks: s.midiData.tracks.map(track => ({
            ...track,
            notes: track.notes.map(note => ({
              ...note,
              timeStart: Math.max(0, note.timeStart - shiftAmount)
            }))
          }))
        };
      }
    }

    set({
      audioBuffer: newBuffer,
      audioFile: newFile,
      audioUrl: newUrl,
      audioDuration: newBuffer.duration,
      trimEnd: newBuffer.duration,
      audioStartTime: newAudioStartTime,
      chartEndPosition: mode === 'start' ? Math.max(0, s.chartEndPosition - shiftAmount) : anchor,
      ...(shiftAmount > 0 ? { 
        midiData: newMidiData,
        playbackAnchor: Math.max(0, s.playbackAnchor - shiftAmount),
        playbackPosition: Math.max(0, s.playbackPosition - shiftAmount),
      } : {})
    });
    
    get().commitHistory();
  },

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
      history: [{
        tracks: JSON.parse(JSON.stringify(data.tracks)),
        selectedTrackId: data.tracks.length > 0 ? data.tracks[0].id : null,
        selectedNoteIds: [],
        chartEndPosition: data.duration || 60,
        audioStartTime: 0,
        playbackAnchor: 0,
        bpm: data.bpm,
        gameBlocks: useStore.getState().gameBlocks ? JSON.parse(JSON.stringify(useStore.getState().gameBlocks)) : [],
        gameEvents: useStore.getState().gameEvents ? JSON.parse(JSON.stringify(useStore.getState().gameEvents)) : []
      }],
      historyIndex: 0,
      ghostNoteVisibility: {},
      trackMute: {}
    });
  },
  appendMidiData: (data) => {
    const s = get();
    if (!s.midiData) {
      get().setMidiData(data);
      return;
    }
    
    // Start IDs after the maximum current track ID
    const startTrackId = Math.max(0, ...s.midiData.tracks.map(t => t.id)) + 1;
    const newTracks = data.tracks.map((t, i) => ({
      ...t,
      id: startTrackId + i
    }));
    
    const updatedData = {
      ...s.midiData,
      duration: Math.max(s.midiData.duration || 60, data.duration || 60),
      tracks: [...s.midiData.tracks, ...newTracks]
    };
    
    nextTrackIdObj = startTrackId + newTracks.length;
    
    set({
      midiData: updatedData,
      chartEndPosition: Math.max(s.chartEndPosition, data.duration || 60)
    });
    
    get().commitHistory();
  },
  setBpm: (bpm) => {
    const s = get();
    if (s.midiData) {
      set({ bpm, midiData: { ...s.midiData, bpm } });
      get().commitHistory();
    } else {
      set({ bpm });
    }
    
    // Also sync BPM to all game tracks so the runner speed updates
    const mainStoreState = useStore.getState();
    const trackUpdates = mainStoreState.tracks.map((t) => ({
      id: t.id,
      updates: { bpm }
    }));
    if (trackUpdates.length > 0) {
      trackUpdates.forEach((tu) => mainStoreState.updateTrack(tu.id, tu.updates));
    }
  },
  setOffset: (offset) => set({ offset }),
  setLevelMetadata: (metadata) => set((s) => ({ ...s, ...metadata })),
  setMidiVolume: (v) => set({ midiVolume: v }),
  setInstrumentPreset: (v) => set({ instrumentPreset: v }),

  // --- Track Management ---
  selectTrack: (id) => {
    set({ selectedTrackId: id, selectedNoteIds: new Set() });
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
    get().commitHistory();
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
    get().commitHistory();
  },
  removeTrack: (id) => {
    const s = get();
    if (!s.midiData) return;
    s.midiData.tracks = s.midiData.tracks.filter(t => t.id !== id);
    
    let newSelectedId = s.selectedTrackId;
    if (newSelectedId === id) {
      newSelectedId = s.midiData.tracks.length > 0 ? s.midiData.tracks[0].id : null;
    }
    set({ midiData: { ...s.midiData }, selectedTrackId: newSelectedId });
    get().commitHistory();
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
  toggleTrackBackground: (id) => {
    const s = get();
    if (!s.midiData) return;
    const track = s.midiData.tracks.find(t => t.id === id);
    if (track) {
      track.isBackground = !track.isBackground;
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

  addNote: (note, commit = true) => {
    const track = get().getCurrentTrack();
    if (!track) return;
    track.notes.push(note);
    set({ midiData: { ...get().midiData! } });
    if (commit) get().commitHistory();
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
    if (!s.midiData) return;
    syncCanvasToGameBlocks();
    const mainState = useStore.getState();
    const snapshot: HistorySnapshot = {
      tracks: JSON.parse(JSON.stringify(s.midiData.tracks)),
      selectedTrackId: s.selectedTrackId,
      selectedNoteIds: Array.from(s.selectedNoteIds),
      chartEndPosition: s.chartEndPosition,
      audioStartTime: s.audioStartTime,
      playbackAnchor: s.playbackAnchor,
      bpm: s.bpm,
      gameBlocks: JSON.parse(JSON.stringify(mainState.gameBlocks)),
      gameEvents: JSON.parse(JSON.stringify(mainState.gameEvents)),
    };
    const newHistory = s.history.slice(0, s.historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > s.historyLimit) {
      newHistory.splice(0, newHistory.length - s.historyLimit);
    }
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    });
  },

  setHistoryLimit: (limit) => set((s) => {
    let newHistory = [...s.history];
    if (newHistory.length > limit) {
      newHistory = newHistory.slice(newHistory.length - limit);
    }
    return {
      historyLimit: limit,
      history: newHistory,
      historyIndex: Math.min(s.historyIndex, newHistory.length - 1)
    };
  }),

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0 || !s.midiData) return;
    const newIndex = s.historyIndex - 1;
    const snapshot = s.history[newIndex];
    const currentSnapshot = s.history[s.historyIndex];
    
    let changedTab: 'pianoroll' | 'blocks' | null = null;
    let msg = 'Undo: Modification';

    if (JSON.stringify(currentSnapshot.gameBlocks) !== JSON.stringify(snapshot.gameBlocks) || 
        JSON.stringify(currentSnapshot.gameEvents) !== JSON.stringify(snapshot.gameEvents)) {
      changedTab = 'blocks';
      if ((currentSnapshot.gameBlocks?.length || 0) > (snapshot.gameBlocks?.length || 0)) msg = 'Undo: Add Block';
      else if ((currentSnapshot.gameBlocks?.length || 0) < (snapshot.gameBlocks?.length || 0)) msg = 'Undo: Delete Block';
      else msg = 'Undo: Modify Block';
    } else if (JSON.stringify(currentSnapshot.tracks) !== JSON.stringify(snapshot.tracks)) {
      changedTab = 'pianoroll';
      const cNotes = currentSnapshot.tracks.reduce((sum, t) => sum + t.notes.length, 0);
      const sNotes = snapshot.tracks.reduce((sum, t) => sum + t.notes.length, 0);
      if (cNotes > sNotes) msg = 'Undo: Add Note';
      else if (cNotes < sNotes) msg = 'Undo: Delete Note';
      else msg = 'Undo: Modify Note';
    } else if (currentSnapshot.bpm !== snapshot.bpm) {
      msg = 'Undo: Change BPM';
    }

    set({
      midiData: { ...s.midiData, tracks: JSON.parse(JSON.stringify(snapshot.tracks)), bpm: snapshot.bpm || s.bpm },
      bpm: snapshot.bpm || s.bpm,
      selectedTrackId: snapshot.selectedTrackId,
      historyIndex: newIndex,
      selectedNoteIds: new Set(snapshot.selectedNoteIds),
      ...(snapshot.chartEndPosition !== undefined && { chartEndPosition: snapshot.chartEndPosition }),
      ...(snapshot.audioStartTime !== undefined && { audioStartTime: snapshot.audioStartTime }),
      ...(snapshot.playbackAnchor !== undefined && { 
        playbackAnchor: snapshot.playbackAnchor,
        playbackPosition: s.isPlaying ? s.playbackPosition : snapshot.playbackAnchor
      }),
      ...(changedTab ? { activeTab: changedTab } : {})
    });
    const mainState = useStore.getState();
    if (snapshot.gameBlocks) mainState.setGameBlocks(JSON.parse(JSON.stringify(snapshot.gameBlocks)));
    if (snapshot.gameEvents) mainState.setGameEvents(JSON.parse(JSON.stringify(snapshot.gameEvents)));
    mainState.showToast(msg);
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1 || !s.midiData) return;
    const newIndex = s.historyIndex + 1;
    const snapshot = s.history[newIndex];
    const currentSnapshot = s.history[s.historyIndex];
    
    let changedTab: 'pianoroll' | 'blocks' | null = null;
    let msg = 'Redo: Modification';

    if (JSON.stringify(currentSnapshot.gameBlocks) !== JSON.stringify(snapshot.gameBlocks) || 
        JSON.stringify(currentSnapshot.gameEvents) !== JSON.stringify(snapshot.gameEvents)) {
      changedTab = 'blocks';
      if ((currentSnapshot.gameBlocks?.length || 0) < (snapshot.gameBlocks?.length || 0)) msg = 'Redo: Add Block';
      else if ((currentSnapshot.gameBlocks?.length || 0) > (snapshot.gameBlocks?.length || 0)) msg = 'Redo: Delete Block';
      else msg = 'Redo: Modify Block';
    } else if (JSON.stringify(currentSnapshot.tracks) !== JSON.stringify(snapshot.tracks)) {
      changedTab = 'pianoroll';
      const cNotes = currentSnapshot.tracks.reduce((sum, t) => sum + t.notes.length, 0);
      const sNotes = snapshot.tracks.reduce((sum, t) => sum + t.notes.length, 0);
      if (cNotes < sNotes) msg = 'Redo: Add Note';
      else if (cNotes > sNotes) msg = 'Redo: Delete Note';
      else msg = 'Redo: Modify Note';
    } else if (currentSnapshot.bpm !== snapshot.bpm) {
      msg = 'Redo: Change BPM';
    }

    set({
      midiData: { ...s.midiData, tracks: JSON.parse(JSON.stringify(snapshot.tracks)), bpm: snapshot.bpm || s.bpm },
      bpm: snapshot.bpm || s.bpm,
      selectedTrackId: snapshot.selectedTrackId,
      historyIndex: newIndex,
      selectedNoteIds: new Set(snapshot.selectedNoteIds),
      ...(snapshot.chartEndPosition !== undefined && { chartEndPosition: snapshot.chartEndPosition }),
      ...(snapshot.audioStartTime !== undefined && { audioStartTime: snapshot.audioStartTime }),
      ...(snapshot.playbackAnchor !== undefined && { 
        playbackAnchor: snapshot.playbackAnchor,
        playbackPosition: s.isPlaying ? s.playbackPosition : snapshot.playbackAnchor
      }),
      ...(changedTab ? { activeTab: changedTab } : {})
    });
    const mainState = useStore.getState();
    if (snapshot.gameBlocks) mainState.setGameBlocks(JSON.parse(JSON.stringify(snapshot.gameBlocks)));
    if (snapshot.gameEvents) mainState.setGameEvents(JSON.parse(JSON.stringify(snapshot.gameEvents)));
    mainState.showToast(msg);
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

  // --- Charting ---
  setChartingNoteIndex: (index) => set({ chartingNoteIndex: index }),
  setChartingPaused: (paused) => set({ chartingPaused: paused }),
  setChartingAutoSkipAssigned: (v) => set({ chartingAutoSkipAssigned: v }),
  setChartingAwaitingPick: (v) => set({ chartingAwaitingPick: v }),
  setChartingHighlightIds: (ids) => set({ chartingHighlightIds: ids }),

  assignNoteTarget: (noteId, trackId, targetId, targetType) => {
    const s = get();
    if (!s.midiData) return;
    const tracks = JSON.parse(JSON.stringify(s.midiData.tracks)) as EditorTrack[];
    const track = tracks.find((t) => t.id === trackId);
    const note = track?.notes.find((n) => n.id === noteId);
    if (!note) return;
    note.targetId = targetId;
    note.targetType = targetType;
    const midiData = { ...s.midiData, tracks };
    set({ midiData, chartingAwaitingPick: false, chartingHighlightIds: [] });
    syncGameEventsFromMidi(midiData);
    get().commitHistory();
  },

  clearNoteTarget: (noteId, trackId) => {
    const s = get();
    if (!s.midiData) return;
    const tracks = JSON.parse(JSON.stringify(s.midiData.tracks)) as EditorTrack[];
    const track = tracks.find((t) => t.id === trackId);
    const note = track?.notes.find((n) => n.id === noteId);
    if (!note) return;
    delete note.targetId;
    delete note.targetType;
    const midiData = { ...s.midiData, tracks };
    set({ midiData });
    syncGameEventsFromMidi(midiData);
    get().commitHistory();
  },

  startChartRecording: () => {
    set({
      isRecordingChart: true,
      recordedChartHits: [],
      recordMatchPreview: null,
    });
    useStore.getState().setMode('select');
  },

  stopChartRecording: () => {
    const s = get();
    set({ isRecordingChart: false });
    if (!s.midiData || s.recordedChartHits.length === 0) return;
    const preview = matchRecordedHits(s.midiData, s.recordedChartHits);
    set({ recordMatchPreview: preview });
  },

  recordChartHit: (blockId, blockType) => {
    const s = get();
    if (!s.isRecordingChart) return;
    const hit: RecordedHit = {
      time: s.playbackPosition * 1000,
      blockId,
      blockType,
    };
    set({ recordedChartHits: [...s.recordedChartHits, hit] });
  },

  discardChartRecording: () => {
    set({ recordedChartHits: [], recordMatchPreview: null, isRecordingChart: false });
  },

  setRecordMatchPreview: (preview) => set({ recordMatchPreview: preview }),

  applyRecordMatch: () => {
    const s = get();
    if (!s.midiData || !s.recordMatchPreview) return;
    const midiData = applyMatchResult(s.midiData, s.recordMatchPreview.matched);
    set({ midiData, recordMatchPreview: null, recordedChartHits: [], isRecordingChart: false });
    syncGameEventsFromMidi(midiData);
    get().commitHistory();
  },

  // --- Reset ---
  reset: () => {
    const prev = get().audioUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      audioFile: null, audioBuffer: null, audioUrl: null,
      trimStart: 0, trimEnd: 0, audioVolume: 80, audioPlaybackRate: 1.0,
      audioStartTime: 0, audioDuration: 0,
      levelTitle: '', levelAuthor: '', levelDescription: '', levelMidiCredit: '', levelMusicCredit: '',
      bpm: 120, offset: 0, midiData: {
        bpm: 120,
        duration: 60,
        tracks: [{
          id: 0,
          name: 'Track 1',
          notes: [],
          instrument: 'piano'
        }]
      }, selectedTrackId: 0,
      midiVolume: 80, instrumentPreset: 'piano',
      ghostNoteVisibility: {}, trackMute: {},
      zoomLevel: 100, scrollLeft: 0, scrollTop: 800, showVelocityTab: true,
      playbackPosition: 0, playbackAnchor: 0, isPlaying: false, chartEndPosition: 60,
      selectedNoteIds: new Set(),
      history: [{
        tracks: [{
          id: 0,
          name: 'Track 1',
          notes: [],
          instrument: 'piano'
        }],
        selectedTrackId: 0,
        selectedNoteIds: [],
        chartEndPosition: 60,
        audioStartTime: 0,
        playbackAnchor: 0
      }], historyIndex: 0, clipboard: [], clipboardSourceTrackId: null,
      activeTab: 'pianoroll' as const,
      chartingNoteIndex: 0,
      chartingPaused: false,
      chartingAutoSkipAssigned: true,
      chartingAwaitingPick: false,
      chartingHighlightIds: [],
      isRecordingChart: false,
      recordedChartHits: [],
      recordMatchPreview: null,
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as { levelEditorStore?: typeof useLevelEditorStore }).levelEditorStore = useLevelEditorStore;
}
