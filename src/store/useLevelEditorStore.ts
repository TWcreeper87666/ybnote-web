import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sliceAudioBuffer, encodeToMp3 } from '../utils/levelUtils';
import { syncGameEventsFromMidi, applyMatchResult, matchRecordedHits, syncCanvasToGameBlocks, type RecordedHit } from '../utils/chartUtils';
import { useUIStore } from './useUIStore';
import { useStore } from './useStore';
import { INITIAL_CANVAS_STATE, buildCanvasActions } from './createCanvasSlice';
import type { CanvasSliceState, CanvasSliceActions } from './createCanvasSlice';
import type { EditorNote, EditorTrack, ParsedMidiData, Block } from '../types';

void syncCanvasToGameBlocks; // imported for side-effect compatibility

// --- History ---
interface HistorySnapshot {
  midiTracks: EditorTrack[];
  selectedMidiTrackId: number | null;
  selectedNoteIds: string[];
  chartEndPosition?: number;
  audioStartTime?: number;
  playbackAnchor?: number;
  bpm?: number;
  blocks?: Block[];
  gameEvents?: { time: number; pitch: string; instrument: string; blockId: string; }[];
}

interface LevelEditorSpecificState {
  audioFile: File | null;
  audioBuffer: AudioBuffer | null;
  audioUrl: string | null;
  trimStart: number;
  trimEnd: number;
  audioVolume: number;
  audioPlaybackRate: number;
  audioStartTime: number;
  audioDuration: number;

  bpm: number;
  offset: number;
  levelTitle: string;
  levelAuthor: string;
  levelDescription: string;
  levelMidiCredit: string;
  levelMusicCredit: string;
  midiData: ParsedMidiData | null;
  selectedMidiTrackId: number | null;
  midiVolume: number;
  instrumentPreset: string;

  ghostNoteVisibility: Record<number, boolean>;
  trackMute: Record<number, boolean>;

  zoomLevel: number;
  scrollLeft: number;
  scrollTop: number;
  showVelocityTab: boolean;

  playbackPosition: number;
  playbackAnchor: number;
  isPlaying: boolean;
  chartEndPosition: number;

  selectedNoteIds: Set<string>;

  history: HistorySnapshot[];
  historyIndex: number;
  historyLimit: number;
  clipboard: EditorNote[];
  clipboardSourceTrackId: number | null;

  activeTab: 'pianoroll' | 'blocks' | 'charting';

  chartingNoteIndex: number;
  chartingTrackId: number | null;
  chartingPaused: boolean;
  chartingPlaybackMode: 'note-by-note' | 'skip-assigned' | 'normal';
  chartingAwaitingPick: boolean;
  chartingHighlightIds: string[];
  chartingHighlightWeights: Record<string, number>;
  chartingAssignedHighlightId: string | null;

  isRecordingChart: boolean;
  recordedChartHits: RecordedHit[];
  recordMatchPreview: import('../utils/chartUtils').MatchResult | null;

  gameEvents: { time: number; pitch: string; instrument: string; blockId: string; }[];
}

interface LevelEditorSpecificActions {
  setAudioFile: (file: File, buffer: AudioBuffer, url: string) => void;
  setTrimStart: (t: number) => void;
  setTrimEnd: (t: number) => void;
  setAudioVolume: (v: number) => void;
  setAudioPlaybackRate: (v: number) => void;
  setAudioStartTime: (v: number) => void;
  removeAudio: () => void;
  trimAudioInPlace: (mode: 'start' | 'end') => Promise<void>;

  setMidiData: (data: ParsedMidiData) => void;
  appendMidiData: (data: ParsedMidiData) => void;
  setBpm: (bpm: number) => void;
  setOffset: (offset: number) => void;
  setLevelMetadata: (metadata: Partial<{ levelTitle: string; levelAuthor: string; levelDescription: string; levelMidiCredit: string; levelMusicCredit: string; }>) => void;
  setMidiVolume: (v: number) => void;
  setInstrumentPreset: (v: string) => void;

  selectMidiTrack: (id: number | null) => void;
  addMidiTrack: () => void;
  duplicateMidiTrack: (id: number) => void;
  removeMidiTrack: (id: number) => void;
  renameMidiTrack: (id: number, name: string) => void;
  updateMidiTrackInstrument: (id: number, instrument: string) => void;
  toggleMidiTrackBackground: (id: number) => void;
  toggleTrackMute: (id: number) => void;
  toggleGhostNotes: (id: number) => void;

  setZoomLevel: (level: number, anchorPhysicalX?: number) => void;
  setScrollLeft: (val: number) => void;
  setScrollTop: (val: number) => void;
  setShowVelocityTab: (v: boolean) => void;

  setPlaybackPosition: (pos: number) => void;
  setPlaybackAnchor: (time: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  setChartEndPosition: (pos: number) => void;

  getCurrentTrack: () => EditorTrack | null;
  addNote: (note: EditorNote, commit?: boolean) => void;
  removeNote: (noteId: string) => void;
  removeSelectedNotes: () => void;
  updateNotes: (updates: { id: string; changes: Partial<EditorNote> }[], commit?: boolean) => void;

  selectNote: (noteId: string, multi?: boolean) => void;
  deselectNote: (noteId: string) => void;
  selectAllNotes: () => void;
  clearNoteSelection: () => void;

  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  copySelectedNotes: () => void;
  pasteNotes: (pasteTime?: number) => void;

  setActiveTab: (tab: 'pianoroll' | 'blocks' | 'charting') => void;

  setChartingNoteIndex: (index: number) => void;
  setChartingTrackId: (id: number | null) => void;
  setChartingPaused: (paused: boolean) => void;
  setChartingPlaybackMode: (mode: 'note-by-note' | 'skip-assigned' | 'normal') => void;
  setChartingAssignedHighlightId: (id: string | null) => void;
  setChartingAwaitingPick: (v: boolean) => void;
  setChartingHighlightIds: (ids: string[]) => void;
  setChartingHighlightWeights: (weights: Record<string, number>) => void;
  assignNoteTarget: (noteId: string, trackId: number, targetId: string, targetType: 'block' | 'groupRect') => void;
  clearNoteTarget: (noteId: string, trackId: number) => void;
  startChartRecording: () => void;
  stopChartRecording: () => void;
  recordChartHit: (blockId: string, blockType: 'block' | 'groupRect') => void;
  discardChartRecording: () => void;
  setRecordMatchPreview: (preview: import('../utils/chartUtils').MatchResult | null) => void;
  applyRecordMatch: () => void;
  setGameEvents: (events: LevelEditorSpecificState['gameEvents']) => void;

  reset: () => void;
  setHistoryLimit: (limit: number) => void;
}

export type LevelEditorState = CanvasSliceState & CanvasSliceActions & LevelEditorSpecificState & LevelEditorSpecificActions;

const generateId = () => Math.random().toString(36).substring(2, 9);
let nextTrackIdObj = 1;

export const useLevelEditorStore = create<LevelEditorState>()(
  persist(
    (set, get) => ({
      // Canvas factory slice: blocks, groupRects, tracks (canvas splines), camera, pocket, selections, etc.
      ...INITIAL_CANVAS_STATE,
      ...buildCanvasActions(set as Parameters<typeof buildCanvasActions>[0], get),

      // Override updateBlock to record events when recording is active
      updateBlock: (id, updates) => {
        if (updates.playedAt !== undefined && useStore.getState().isRecording) {
          useStore.getState().recordEvent('block', id);
        }
        set((state) => ({
          ...state,
          blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b),
        }));
      },

      // Override deleteSelected to also clear orphaned MIDI note targetIds
      deleteSelected: () => {
        const s = get();
        const deletedBlockIds = new Set(s.selectedBlockIds);
        set((state) => ({
          blocks: state.blocks.filter(b => !state.selectedBlockIds.includes(b.id)),
          selectedBlockIds: [],
          tracks: state.tracks.filter(t => !state.selectedTrackIds.includes(t.id)),
          runners: state.runners.filter(r => !state.selectedTrackIds.includes(r.trackId)),
          selectedTrackIds: [],
          groupRects: state.groupRects.filter(g => !state.selectedGroupRectIds.includes(g.id)),
          selectedGroupRectIds: [],
        }));
        if (s.midiData && deletedBlockIds.size > 0) {
          const updatedTracks = s.midiData.tracks.map(track => ({
            ...track,
            notes: track.notes.map(note =>
              note.targetId && deletedBlockIds.has(note.targetId)
                ? { ...note, targetId: undefined, targetType: undefined }
                : note
            ),
          }));
          const updatedMidiData = { ...s.midiData, tracks: updatedTracks };
          set({ midiData: updatedMidiData });
          syncGameEventsFromMidi(updatedMidiData);
        }
      },

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
      selectedMidiTrackId: 0,
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

      selectedNoteIds: new Set<string>(),

      history: [{
        midiTracks: [{
          id: 0,
          name: 'Track 1',
          notes: [],
          instrument: 'piano'
        }],
        selectedMidiTrackId: 0,
        selectedNoteIds: [],
        chartEndPosition: 60,
        audioStartTime: 0,
        playbackAnchor: 0,
        bpm: 120,
        blocks: [],
        gameEvents: []
      }],
      historyIndex: 0,
      historyLimit: 50,
      clipboard: [],
      clipboardSourceTrackId: null,

      activeTab: 'pianoroll' as const,

      gameEvents: [] as { time: number; pitch: string; instrument: string; blockId: string; }[],

      chartingNoteIndex: 0,
      chartingTrackId: null as number | null,
      chartingPaused: false,
      chartingPlaybackMode: 'skip-assigned' as const,
      chartingAwaitingPick: false,
      chartingHighlightIds: [],
      chartingHighlightWeights: {},
      chartingAssignedHighlightId: null,

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

        const anchor = s.playbackAnchor;
        const targetAudioTime = anchor - s.audioStartTime;
        if (targetAudioTime < 0 || targetAudioTime > s.audioDuration) return;

        let newTrimStart = 0;
        let newTrimEnd = s.audioDuration;

        if (mode === 'start') {
          newTrimStart = targetAudioTime;
        } else {
          newTrimEnd = targetAudioTime;
        }

        if (newTrimStart >= newTrimEnd) return;

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
        nextTrackIdObj = Math.max(0, ...data.tracks.map(t => t.id)) + 1;

        set({
          midiData: data,
          bpm: data.bpm,
          chartEndPosition: data.duration || 60,
          selectedMidiTrackId: data.tracks.length > 0 ? data.tracks[0].id : null,
          selectedNoteIds: new Set(),
          history: [{
            midiTracks: JSON.parse(JSON.stringify(data.tracks)),
            selectedMidiTrackId: data.tracks.length > 0 ? data.tracks[0].id : null,
            selectedNoteIds: [],
            chartEndPosition: data.duration || 60,
            audioStartTime: 0,
            playbackAnchor: 0,
            bpm: data.bpm,
            blocks: JSON.parse(JSON.stringify(get().blocks)),
            gameEvents: JSON.parse(JSON.stringify(get().gameEvents))
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

        // Sync BPM to canvas spline tracks (for runner speed)
        get().tracks.forEach(t => get().updateTrack(t.id, { bpm }));
      },
      setOffset: (offset) => set({ offset }),
      setLevelMetadata: (metadata) => set((s) => ({ ...s, ...metadata })),
      setMidiVolume: (v) => set({ midiVolume: v }),
      setInstrumentPreset: (v) => set({ instrumentPreset: v }),

      // --- MIDI Track Management ---
      selectMidiTrack: (id) => {
        // In charting tab, stop playback so the RAF closure (which captures chartNotes
        // from the old track) can't fire pauseForNote after selectedMidiTrackId changes.
        if (get().activeTab === 'charting') get().stopPlayback();
        set({ selectedMidiTrackId: id, selectedNoteIds: new Set(), chartingNoteIndex: 0, chartingAwaitingPick: false, chartingHighlightIds: [], chartingHighlightWeights: {}, chartingAssignedHighlightId: null });
      },
      addMidiTrack: () => {
        const s = get();
        let currentMidiData = s.midiData;

        if (!currentMidiData) {
          currentMidiData = {
            bpm: s.bpm || 120,
            duration: s.audioDuration || 60,
            tracks: []
          };
        }

        // Always derive from existing tracks so rehydrated state can't cause ID collisions
        const newTrackId = currentMidiData.tracks.length > 0
          ? Math.max(...currentMidiData.tracks.map(t => t.id)) + 1
          : 0;
        nextTrackIdObj = newTrackId + 1;
        const newTrack: EditorTrack = {
          id: newTrackId,
          name: `Track ${newTrackId + 1}`,
          notes: [],
          instrument: 'piano'
        };
        currentMidiData.tracks.push(newTrack);
        set({ midiData: { ...currentMidiData } });
        get().selectMidiTrack(newTrackId);
        get().commitHistory();
      },
      duplicateMidiTrack: (id) => {
        const s = get();
        if (!s.midiData) return;
        const trackToDup = s.midiData.tracks.find(t => t.id === id);
        if (!trackToDup) return;

        // Derive from existing tracks for the same reason as addMidiTrack
        const newTrackId = Math.max(...s.midiData.tracks.map(t => t.id)) + 1;
        nextTrackIdObj = newTrackId + 1;
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
        get().selectMidiTrack(newTrackId);
        get().commitHistory();
      },
      removeMidiTrack: (id) => {
        const s = get();
        if (!s.midiData) return;
        const newTracks = s.midiData.tracks.filter(t => t.id !== id);
        const newSelectedId = s.selectedMidiTrackId === id
          ? (newTracks[0]?.id ?? null)
          : s.selectedMidiTrackId;
        const newChartingTrackId = s.chartingTrackId === id
          ? (newTracks.find(t => !t.isBackground)?.id ?? null)
          : s.chartingTrackId;
        const updatedMidiData = { ...s.midiData, tracks: newTracks };
        set({ midiData: updatedMidiData, selectedMidiTrackId: newSelectedId, chartingTrackId: newChartingTrackId });
        syncGameEventsFromMidi(updatedMidiData);
        get().commitHistory();
      },
      renameMidiTrack: (id, name) => {
        const s = get();
        if (!s.midiData) return;
        const track = s.midiData.tracks.find(t => t.id === id);
        if (track) {
          track.name = name;
          set({ midiData: { ...s.midiData } });
        }
      },
      updateMidiTrackInstrument: (id, instrument) => {
        const s = get();
        if (!s.midiData) return;
        const track = s.midiData.tracks.find(t => t.id === id);
        if (track) {
          track.instrument = instrument;
          set({ midiData: { ...s.midiData } });
        }
      },
      toggleMidiTrackBackground: (id) => {
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
        return { isPlaying: true, playbackPosition: s.playbackAnchor, chartingAwaitingPick: false };
      }),
      stopPlayback: () => set((s) => ({ isPlaying: false, playbackPosition: s.playbackAnchor })),
      setChartEndPosition: (pos: number) => set({ chartEndPosition: Math.max(0, pos) }),

      // --- Note helpers ---
      getCurrentTrack: () => {
        const s = get();
        if (!s.midiData || s.selectedMidiTrackId === null) return null;
        return s.midiData.tracks.find(t => t.id === s.selectedMidiTrackId) || null;
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

      // --- Selection actions (MIDI notes only) ---
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
      selectAllNotes: () => {
        const track = get().getCurrentTrack();
        if (track) {
          set({ selectedNoteIds: new Set(track.notes.map(n => n.id)) });
        }
      },
      clearNoteSelection: () => set({ selectedNoteIds: new Set() }),

      // --- History ---
      commitHistory: () => {
        const s = get();
        if (!s.midiData) return;
        const snapshot: HistorySnapshot = {
          midiTracks: JSON.parse(JSON.stringify(s.midiData.tracks)),
          selectedMidiTrackId: s.selectedMidiTrackId,
          selectedNoteIds: Array.from(s.selectedNoteIds),
          chartEndPosition: s.chartEndPosition,
          audioStartTime: s.audioStartTime,
          playbackAnchor: s.playbackAnchor,
          bpm: s.bpm,
          blocks: JSON.parse(JSON.stringify(s.blocks)),
          gameEvents: JSON.parse(JSON.stringify(s.gameEvents)),
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

        if (JSON.stringify(currentSnapshot.blocks) !== JSON.stringify(snapshot.blocks) ||
            JSON.stringify(currentSnapshot.gameEvents) !== JSON.stringify(snapshot.gameEvents)) {
          changedTab = 'blocks';
          if ((currentSnapshot.blocks?.length || 0) > (snapshot.blocks?.length || 0)) msg = 'Undo: Add Block';
          else if ((currentSnapshot.blocks?.length || 0) < (snapshot.blocks?.length || 0)) msg = 'Undo: Delete Block';
          else msg = 'Undo: Modify Block';
        } else if (JSON.stringify(currentSnapshot.midiTracks) !== JSON.stringify(snapshot.midiTracks)) {
          changedTab = 'pianoroll';
          const cNotes = currentSnapshot.midiTracks.reduce((sum, t) => sum + t.notes.length, 0);
          const sNotes = snapshot.midiTracks.reduce((sum, t) => sum + t.notes.length, 0);
          if (cNotes > sNotes) msg = 'Undo: Add Note';
          else if (cNotes < sNotes) msg = 'Undo: Delete Note';
          else msg = 'Undo: Modify Note';
        } else if (currentSnapshot.bpm !== snapshot.bpm) {
          msg = 'Undo: Change BPM';
        }

        set({
          midiData: { ...s.midiData, tracks: JSON.parse(JSON.stringify(snapshot.midiTracks)), bpm: snapshot.bpm || s.bpm },
          bpm: snapshot.bpm || s.bpm,
          selectedMidiTrackId: snapshot.selectedMidiTrackId,
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
        if (snapshot.blocks) set({ blocks: JSON.parse(JSON.stringify(snapshot.blocks)) });
        if (snapshot.gameEvents) set({ gameEvents: JSON.parse(JSON.stringify(snapshot.gameEvents)) });
        useUIStore.getState().showToast(msg);
      },

      redo: () => {
        const s = get();
        if (s.historyIndex >= s.history.length - 1 || !s.midiData) return;
        const newIndex = s.historyIndex + 1;
        const snapshot = s.history[newIndex];
        const currentSnapshot = s.history[s.historyIndex];

        let changedTab: 'pianoroll' | 'blocks' | null = null;
        let msg = 'Redo: Modification';

        if (JSON.stringify(currentSnapshot.blocks) !== JSON.stringify(snapshot.blocks) ||
            JSON.stringify(currentSnapshot.gameEvents) !== JSON.stringify(snapshot.gameEvents)) {
          changedTab = 'blocks';
          if ((currentSnapshot.blocks?.length || 0) < (snapshot.blocks?.length || 0)) msg = 'Redo: Add Block';
          else if ((currentSnapshot.blocks?.length || 0) > (snapshot.blocks?.length || 0)) msg = 'Redo: Delete Block';
          else msg = 'Redo: Modify Block';
        } else if (JSON.stringify(currentSnapshot.midiTracks) !== JSON.stringify(snapshot.midiTracks)) {
          changedTab = 'pianoroll';
          const cNotes = currentSnapshot.midiTracks.reduce((sum, t) => sum + t.notes.length, 0);
          const sNotes = snapshot.midiTracks.reduce((sum, t) => sum + t.notes.length, 0);
          if (cNotes < sNotes) msg = 'Redo: Add Note';
          else if (cNotes > sNotes) msg = 'Redo: Delete Note';
          else msg = 'Redo: Modify Note';
        } else if (currentSnapshot.bpm !== snapshot.bpm) {
          msg = 'Redo: Change BPM';
        }

        set({
          midiData: { ...s.midiData, tracks: JSON.parse(JSON.stringify(snapshot.midiTracks)), bpm: snapshot.bpm || s.bpm },
          bpm: snapshot.bpm || s.bpm,
          selectedMidiTrackId: snapshot.selectedMidiTrackId,
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
        if (snapshot.blocks) set({ blocks: JSON.parse(JSON.stringify(snapshot.blocks)) });
        if (snapshot.gameEvents) set({ gameEvents: JSON.parse(JSON.stringify(snapshot.gameEvents)) });
        useUIStore.getState().showToast(msg);
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
      setActiveTab: (tab) => set({ activeTab: tab, chartingAwaitingPick: false, chartingHighlightIds: [], chartingHighlightWeights: {}, chartingAssignedHighlightId: null }),

      // --- Charting ---
      setChartingNoteIndex: (index) => set({ chartingNoteIndex: index }),
      setChartingTrackId: (id) => set({ chartingTrackId: id }),
      setChartingPaused: (paused) => set({ chartingPaused: paused }),
      setChartingAwaitingPick: (v) => set({ chartingAwaitingPick: v }),
      setChartingHighlightIds: (ids) => set({ chartingHighlightIds: ids }),
      setChartingHighlightWeights: (weights) => set({ chartingHighlightWeights: weights }),
      setChartingPlaybackMode: (mode) => set({ chartingPlaybackMode: mode }),
      setChartingAssignedHighlightId: (id) => set({ chartingAssignedHighlightId: id }),

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
        set({ midiData });
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
        get().setMode('select');
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

      setGameEvents: (gameEvents) => set({ gameEvents }),

      // --- Reset ---
      reset: () => {
        const prev = get().audioUrl;
        if (prev) URL.revokeObjectURL(prev);
        set({
          ...INITIAL_CANVAS_STATE,
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
          }, selectedMidiTrackId: 0,
          midiVolume: 80, instrumentPreset: 'piano',
          ghostNoteVisibility: {}, trackMute: {},
          zoomLevel: 100, scrollLeft: 0, scrollTop: 800, showVelocityTab: true,
          playbackPosition: 0, playbackAnchor: 0, isPlaying: false, chartEndPosition: 60,
          selectedNoteIds: new Set(),
          history: [{
            midiTracks: [{
              id: 0,
              name: 'Track 1',
              notes: [],
              instrument: 'piano'
            }],
            selectedMidiTrackId: 0,
            selectedNoteIds: [],
            chartEndPosition: 60,
            audioStartTime: 0,
            playbackAnchor: 0
          }], historyIndex: 0, clipboard: [], clipboardSourceTrackId: null,
          activeTab: 'pianoroll' as const,
          chartingNoteIndex: 0,
          chartingTrackId: null as number | null,
          chartingPaused: false,
          chartingPlaybackMode: 'skip-assigned' as const,
          chartingAwaitingPick: false,
          chartingHighlightIds: [],
          chartingHighlightWeights: {},
          chartingAssignedHighlightId: null,
          isRecordingChart: false,
          recordedChartHits: [],
          recordMatchPreview: null,
          gameEvents: [],
        });
      },
    }),
    {
      name: 'level-editor',
      partialize: (s) => ({
        blocks: s.blocks,
        groupRects: s.groupRects,
        tracks: s.tracks,
        camera: s.camera,
        pocketBlocks: s.pocketBlocks,
        pocketSortMode: s.pocketSortMode,
        pocketCamera: s.pocketCamera,
        midiData: s.midiData,
        bpm: s.bpm,
        offset: s.offset,
        levelTitle: s.levelTitle,
        levelAuthor: s.levelAuthor,
        levelDescription: s.levelDescription,
        levelMidiCredit: s.levelMidiCredit,
        levelMusicCredit: s.levelMusicCredit,
        gameEvents: s.gameEvents,
        selectedMidiTrackId: s.selectedMidiTrackId,
        chartEndPosition: s.chartEndPosition,
        activeTab: s.activeTab,
      })
    }
  )
);

if (typeof window !== 'undefined') {
  (window as { levelEditorStore?: typeof useLevelEditorStore }).levelEditorStore = useLevelEditorStore;
}
