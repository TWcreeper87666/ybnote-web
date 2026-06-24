import type { StoreSlice } from './storeTypes';
import type { Mode } from '../types';
import { updateCanvas } from './utils';

export interface PlaybackSlice {
  isPlaying: boolean;
  trackPlaybackStatus: Record<string, 'playing' | 'paused'>;
  mode: Mode;
  editingTrackId: string | null;
  activeTrackId: string | null;

  isRecording: boolean;
  recordedEvents: { time: number; type: 'block' | 'groupRect'; targetId: string }[];
  recordingStartTime: number | null;

  togglePlay: () => void;
  stopPlay: () => void;
  playTrack: (id: string) => void;
  pauseTrack: (id: string) => void;
  stopTrack: (id: string) => void;
  setMode: (mode: Mode) => void;
  setEditingTrackId: (id: string | null) => void;
  setActiveTrackId: (id: string | null) => void;

  startRecording: () => void;
  stopRecording: () => void;
  recordEvent: (type: 'block' | 'groupRect', targetId: string) => void;
  clearRecordedEvents: () => void;
}

export const createPlaybackSlice: StoreSlice<PlaybackSlice> = (set) => ({
  isPlaying: false,
  trackPlaybackStatus: {},
  mode: 'select',
  editingTrackId: null,
  activeTrackId: null,

  isRecording: false,
  recordedEvents: [],
  recordingStartTime: null,

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  stopPlay: () => set({ isPlaying: false, trackPlaybackStatus: {}, runners: [], editorRunners: [] }),
  playTrack: (id) => set((state) => ({ trackPlaybackStatus: { ...state.trackPlaybackStatus, [id]: 'playing' } })),
  pauseTrack: (id) => set((state) => ({ trackPlaybackStatus: { ...state.trackPlaybackStatus, [id]: 'paused' } })),
  stopTrack: (id) => updateCanvas(set, (canvas, state) => {
    const newStatus = { ...state.trackPlaybackStatus };
    delete newStatus[id];
    return {
      trackPlaybackStatus: newStatus,
      runners: canvas.runners.filter(r => r.trackId !== id)
    };
  }),
  setMode: (mode) => set((state) => {
    const updates: Partial<PlaybackSlice & import('./uiSlice').UISlice & import('./canvasSlice').CanvasSlice> = {
      mode,
      activeTrackId: mode === 'select' ? null : state.activeTrackId,
      selectedBlockIds: mode === 'draw_track' || mode === 'draw_group' || mode === 'play' ? [] : state.selectedBlockIds,
      selectedTrackIds: mode === 'draw_track' || mode === 'draw_group' || mode === 'play' ? [] : state.selectedTrackIds,
      selectedGroupRectIds: mode === 'draw_track' || mode === 'draw_group' || mode === 'play' ? [] : state.selectedGroupRectIds,
    };

    if (mode === 'play') {
       updates.contextMenu = null;
       if (!state.uiStateBeforePlay) {
           updates.uiStateBeforePlay = {
               isPianoOpen: state.isPianoOpen,
               isSettingsOpen: state.isSettingsOpen,
               isHelpOpen: state.isHelpOpen,
               isOutlinerOpen: state.isOutlinerOpen,
               isSearchOpen: state.isSearchOpen,
               selectedBlockIds: state.selectedBlockIds,
               selectedTrackIds: state.selectedTrackIds,
               selectedGroupRectIds: state.selectedGroupRectIds,
               activeTrackId: state.activeTrackId,
           };
       }
       updates.isPianoOpen = false;
       updates.isSettingsOpen = false;
       updates.isHelpOpen = false;
       updates.isOutlinerOpen = false;
       updates.isSearchOpen = false;
    } else {
       updates.isPianoOpen = mode === 'piano';
       updates.isSettingsOpen = false;
       updates.isHelpOpen = false;
       
       if (state.mode === 'play' && state.uiStateBeforePlay) {
           updates.isPianoOpen = mode === 'piano' ? true : state.uiStateBeforePlay.isPianoOpen;
           updates.isSettingsOpen = state.uiStateBeforePlay.isSettingsOpen;
           updates.isHelpOpen = state.uiStateBeforePlay.isHelpOpen;
           updates.isOutlinerOpen = state.uiStateBeforePlay.isOutlinerOpen;
           updates.isSearchOpen = state.uiStateBeforePlay.isSearchOpen;
           
           updates.selectedBlockIds = state.uiStateBeforePlay.selectedBlockIds;
           updates.selectedTrackIds = state.uiStateBeforePlay.selectedTrackIds;
           updates.selectedGroupRectIds = state.uiStateBeforePlay.selectedGroupRectIds;
           updates.activeTrackId = state.uiStateBeforePlay.activeTrackId;
           
           updates.uiStateBeforePlay = undefined;
       }
    }

    return updates;
  }),
  setEditingTrackId: (editingTrackId) => set({ editingTrackId }),
  setActiveTrackId: (activeTrackId) => set({ activeTrackId, selectedBlockIds: [], selectedTrackIds: activeTrackId ? [activeTrackId] : [], selectedGroupRectIds: [] }),

  startRecording: () => set({ isRecording: true, recordingStartTime: Date.now(), recordedEvents: [] }),
  stopRecording: () => set({ isRecording: false, recordingStartTime: null }),
  recordEvent: (type, targetId) => set((state) => {
    if (!state.isRecording || !state.recordingStartTime) return state;
    const time = Date.now() - state.recordingStartTime;
    return { recordedEvents: [...state.recordedEvents, { time, type, targetId }] };
  }),
  clearRecordedEvents: () => set({ recordedEvents: [] }),
});
