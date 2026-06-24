import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { Block, Mode } from '../types';
import { createCanvasFeature, type CanvasFeatureHost } from './shared/createCanvasFeature';
import type { CanvasFeature } from './shared/canvasTypes';
import { canvasPersistKeys } from './shared/canvasTypes';
import { useToastStore } from './useToastStore';
import { generateId } from './shared/generateId';

// --- Pocket ---
interface PocketState {
  pocketBlocks: Block[];
  arrangedPocketBlocks: Block[];
  pocketSortMode: 'pitch' | 'time';
  selectedPocketBlockIds: string[];
  pocketCamera: { x: number; y: number; zoom: number };
  interactionContext: 'main' | 'pocket';
  activePocketDrag: {
    offsetX: number;
    offsetY: number;
    blocks: Block[];
    clickedBlockId: string;
    initialX?: number;
    initialY?: number;
  } | null;

  setPocketBlocks: (blocks: Block[]) => void;
  updatePocketBlock: (id: string, updates: Partial<Block>) => void;
  setArrangedPocketBlocks: (blocks: Block[]) => void;
  setPocketSortMode: (mode: 'pitch' | 'time') => void;
  selectPocketBlock: (id: string, multi?: boolean) => void;
  clearPocketSelection: () => void;
  selectAllPocketBlocks: () => void;
  copyPocketSelectedToMain: () => void;
  updatePocketCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;
  setInteractionContext: (context: 'main' | 'pocket') => void;
  setActivePocketDrag: (
    drag: PocketState['activePocketDrag'],
  ) => void;
}

// --- Playback ---
interface PlaybackState {
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

// --- Playground UI ---
interface PlaygroundUIState {
  isPianoOpen: boolean;
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  isOutlinerOpen: boolean;
  isPocketCanvasOpen: boolean;
  isTutorialOpen: boolean;
  searchQuery: string;
  isSearchOpen: boolean;
  contextMenu: { x: number; y: number; blockId: string } | null;
  uiStateBeforePlay?: {
    isPianoOpen: boolean;
    isSettingsOpen: boolean;
    isHelpOpen: boolean;
    isOutlinerOpen: boolean;
    isSearchOpen: boolean;
    selectedBlockIds: string[];
    selectedTrackIds: string[];
    selectedGroupRectIds: string[];
    activeTrackId: string | null;
  };

  togglePiano: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  toggleOutliner: () => void;
  togglePocketCanvas: () => void;
  toggleTutorial: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  openContextMenu: (menu: { x: number; y: number; blockId: string }) => void;
  closeContextMenu: () => void;
  toggleContextMenu: (menu: { x: number; y: number; blockId: string }) => void;
}

export type PlaygroundStoreState = CanvasFeature &
  PocketState &
  PlaybackState &
  PlaygroundUIState &
  Pick<CanvasFeatureHost, 'recordEvent' | 'showToast'>;

const pickPersist = (state: PlaygroundStoreState) =>
  Object.fromEntries(canvasPersistKeys.map((k) => [k, state[k]]));

export const usePlaygroundStore = create<PlaygroundStoreState>()(
  temporal(
    persist(
      (set, get) => {
        const canvas = createCanvasFeature(set as never, get as never, {
          onContinuousMutateStart: (snapshot) => {
            usePlaygroundStore.temporal.setState((s) => ({
              pastStates: [...s.pastStates, snapshot],
              futureStates: [],
            }));
            usePlaygroundStore.temporal.getState().pause();
            setTimeout(() => usePlaygroundStore.temporal.getState().resume(), 500);
          },
        });

        return {
          ...canvas,

          showToast: (msg) => useToastStore.getState().showToast(msg),

          // Pocket
          pocketBlocks: [],
          arrangedPocketBlocks: [],
          pocketSortMode: 'pitch' as const,
          selectedPocketBlockIds: [],
          pocketCamera: { x: 0, y: 0, zoom: 1 },
          interactionContext: 'main' as const,
          activePocketDrag: null,

          setPocketBlocks: (blocks) =>
            set({ pocketBlocks: blocks, selectedPocketBlockIds: [] }),
          updatePocketBlock: (id, updates) => {
            if (updates.playedAt !== undefined) get().recordEvent('block', id);
            set((s) => ({
              pocketBlocks: s.pocketBlocks.map((b) =>
                b.id === id ? { ...b, ...updates } : b,
              ),
            }));
          },
          setArrangedPocketBlocks: (blocks) => set({ arrangedPocketBlocks: blocks }),
          setPocketSortMode: (mode) => set({ pocketSortMode: mode }),
          updatePocketCamera: (cameraUpdates) =>
            set((s) => ({ pocketCamera: { ...s.pocketCamera, ...cameraUpdates } })),
          setInteractionContext: (context) => set({ interactionContext: context }),
          setActivePocketDrag: (drag) => set({ activePocketDrag: drag }),
          selectPocketBlock: (id, multi) =>
            set((s) => {
              const updates: Partial<PocketState> = { interactionContext: 'pocket' };
              if (multi) {
                const isSelected = s.selectedPocketBlockIds.includes(id);
                updates.selectedPocketBlockIds = isSelected
                  ? s.selectedPocketBlockIds.filter((selId) => selId !== id)
                  : [...s.selectedPocketBlockIds, id];
              } else {
                updates.selectedPocketBlockIds = [id];
              }
              return updates;
            }),
          clearPocketSelection: () => set({ selectedPocketBlockIds: [] }),
          selectAllPocketBlocks: () =>
            set((s) => ({ selectedPocketBlockIds: s.pocketBlocks.map((b) => b.id) })),
          copyPocketSelectedToMain: () => {
            const s = get();
            const selected = s.pocketBlocks.filter((b) =>
              s.selectedPocketBlockIds.includes(b.id),
            );
            if (selected.length === 0) return;
            const newBlocks = selected.map((b) => ({ ...b, id: generateId(), groupId: undefined }));
            set({
              blocks: [...s.blocks, ...newBlocks],
              selectedBlockIds: newBlocks.map((b) => b.id),
              selectedPocketBlockIds: [],
            });
          },

          // Playback
          isPlaying: false,
          trackPlaybackStatus: {},
          mode: 'select' as Mode,
          editingTrackId: null,
          activeTrackId: null,
          isRecording: false,
          recordedEvents: [],
          recordingStartTime: null,

          togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
          stopPlay: () => set({ isPlaying: false, trackPlaybackStatus: {}, runners: [] }),
          playTrack: (id) =>
            set((s) => ({
              trackPlaybackStatus: { ...s.trackPlaybackStatus, [id]: 'playing' },
            })),
          pauseTrack: (id) =>
            set((s) => ({
              trackPlaybackStatus: { ...s.trackPlaybackStatus, [id]: 'paused' },
            })),
          stopTrack: (id) =>
            set((s) => {
              const newStatus = { ...s.trackPlaybackStatus };
              delete newStatus[id];
              return {
                trackPlaybackStatus: newStatus,
                runners: s.runners.filter((r) => r.trackId !== id),
              };
            }),
          setMode: (mode) =>
            set((s) => {
              const updates: Partial<PlaygroundStoreState> = {
                mode,
                activeTrackId: mode === 'select' ? null : s.activeTrackId,
                selectedBlockIds:
                  mode === 'draw_track' || mode === 'draw_group' || mode === 'play'
                    ? []
                    : s.selectedBlockIds,
                selectedTrackIds:
                  mode === 'draw_track' || mode === 'draw_group' || mode === 'play'
                    ? []
                    : s.selectedTrackIds,
                selectedGroupRectIds:
                  mode === 'draw_track' || mode === 'draw_group' || mode === 'play'
                    ? []
                    : s.selectedGroupRectIds,
              };
              if (mode === 'play') {
                updates.contextMenu = null;
                if (!s.uiStateBeforePlay) {
                  updates.uiStateBeforePlay = {
                    isPianoOpen: s.isPianoOpen,
                    isSettingsOpen: s.isSettingsOpen,
                    isHelpOpen: s.isHelpOpen,
                    isOutlinerOpen: s.isOutlinerOpen,
                    isSearchOpen: s.isSearchOpen,
                    selectedBlockIds: s.selectedBlockIds,
                    selectedTrackIds: s.selectedTrackIds,
                    selectedGroupRectIds: s.selectedGroupRectIds,
                    activeTrackId: s.activeTrackId,
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
                if (s.mode === 'play' && s.uiStateBeforePlay) {
                  const prev = s.uiStateBeforePlay;
                  updates.isPianoOpen = mode === 'piano' ? true : prev.isPianoOpen;
                  updates.isSettingsOpen = prev.isSettingsOpen;
                  updates.isHelpOpen = prev.isHelpOpen;
                  updates.isOutlinerOpen = prev.isOutlinerOpen;
                  updates.isSearchOpen = prev.isSearchOpen;
                  updates.selectedBlockIds = prev.selectedBlockIds;
                  updates.selectedTrackIds = prev.selectedTrackIds;
                  updates.selectedGroupRectIds = prev.selectedGroupRectIds;
                  updates.activeTrackId = prev.activeTrackId;
                  updates.uiStateBeforePlay = undefined;
                }
              }
              return updates;
            }),
          setEditingTrackId: (editingTrackId) => set({ editingTrackId }),
          setActiveTrackId: (activeTrackId) =>
            set({
              activeTrackId,
              selectedBlockIds: [],
              selectedTrackIds: activeTrackId ? [activeTrackId] : [],
              selectedGroupRectIds: [],
            }),
          startRecording: () =>
            set({ isRecording: true, recordingStartTime: Date.now(), recordedEvents: [] }),
          stopRecording: () => set({ isRecording: false, recordingStartTime: null }),
          recordEvent: (type, targetId) => {
            const s = get();
            if (!s.isRecording || !s.recordingStartTime) return;
            const time = Date.now() - s.recordingStartTime;
            set({ recordedEvents: [...s.recordedEvents, { time, type, targetId }] });
          },
          clearRecordedEvents: () => set({ recordedEvents: [] }),

          // UI
          isPianoOpen: false,
          isSettingsOpen: false,
          isHelpOpen: false,
          isOutlinerOpen: false,
          isPocketCanvasOpen: false,
          isTutorialOpen: false,
          searchQuery: '',
          isSearchOpen: false,
          contextMenu: null,

          togglePiano: () => set((s) => ({ isPianoOpen: !s.isPianoOpen })),
          toggleSettings: () =>
            set((s) => ({
              isSettingsOpen: !s.isSettingsOpen,
              isHelpOpen: false,
              isTutorialOpen: false,
            })),
          toggleHelp: () =>
            set((s) => ({
              isHelpOpen: !s.isHelpOpen,
              isSettingsOpen: false,
              isTutorialOpen: false,
            })),
          toggleOutliner: () => set((s) => ({ isOutlinerOpen: !s.isOutlinerOpen })),
          togglePocketCanvas: () =>
            set((s) => ({
              isPocketCanvasOpen: !s.isPocketCanvasOpen,
              interactionContext:
                s.isPocketCanvasOpen && s.interactionContext === 'pocket' ? 'main' : s.interactionContext,
            })),
          toggleTutorial: () =>
            set((s) => ({
              isTutorialOpen: !s.isTutorialOpen,
              isSettingsOpen: false,
              isHelpOpen: false,
            })),
          setSearchQuery: (query) => set({ searchQuery: query }),
          setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
          openContextMenu: (menu) => set({ contextMenu: menu }),
          closeContextMenu: () => set({ contextMenu: null }),
          toggleContextMenu: (menu) =>
            set((s) => ({
              contextMenu: s.contextMenu?.blockId === menu.blockId ? null : menu,
            })),
        };
      },
      {
        name: 'ybnote-playground',
        partialize: (state) => ({
          ...pickPersist(state),
          groups: state.groups,
          recordedEvents: state.recordedEvents,
        }),
      },
    ),
    {
      partialize: (state) => pickPersist(state),
    },
  ),
);

/** playground canvas store — 型別上相容 CanvasStore，供 CanvasStoreProvider 使用 */
export const playgroundCanvasStore = usePlaygroundStore as unknown as import('./shared/canvasTypes').CanvasStore;
