import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { isLevelEditor } from '../utils/routeUtils';

let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isHistoryPausedForContinuous = false;

import type { Block, Group, GroupRect, CameraState, TrackNode, Track, Runner, Theme, Mode, HitEvent } from '../types';

interface AppState {
  blocks: Block[];
  groups: Group[];
  groupRects: GroupRect[];
  tracks: Track[];
  runners: Runner[];
  selectedBlockIds: string[];
  selectedTrackIds: string[];
  selectedGroupRectIds: string[];
  clipboardBlocks: Block[];
  clipboardTracks: Track[];
  clipboardGroupRects: GroupRect[];
  camera: CameraState;
  theme: Theme;
  showGrid: boolean;
  snapToGrid: boolean;

  // UI States
  isPianoOpen: boolean;
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  isOutlinerOpen: boolean;
  isPocketCanvasOpen: boolean;
  isTutorialOpen: boolean;
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
  searchQuery: string;
  isSearchOpen: boolean;

  pocketBlocks: Block[];
  arrangedPocketBlocks: Block[];
  pocketSortMode: 'pitch' | 'time';
  selectedPocketBlockIds: string[];
  pocketCamera: CameraState;
  interactionContext: 'main' | 'pocket';
  activePocketDrag: { offsetX: number, offsetY: number, blocks: Block[], clickedBlockId: string, initialX?: number, initialY?: number } | null;

  // Display Settings
  showGroupName: boolean;
  showBlockPitch: boolean;
  showBlockVolume: boolean;
  showBlockInstrument: boolean;

  hoveredBlockId: string | null;
  hoveredGroupRectId: string | null;
  activeNodeDrag: { trackId: string, nodeId: string, isNewNode?: boolean } | null;

  // Playback & Mode
  isPlaying: boolean;
  trackPlaybackStatus: Record<string, 'playing' | 'paused'>;
  mode: Mode;
  editingTrackId: string | null;
  activeTrackId: string | null;

  pianoKeysCount: number;
  blockOpacity: number;
  mouseSensitivity: number;
  masterVolume: number;
  contextMenu: { x: number, y: number, blockId: string } | null;

  lastSelectedId: string | null;
  lastSelectedType: 'block' | 'groupRect' | 'track' | null;

  // Actions
  addBlock: (block: Omit<Block, 'id'>) => string;
  addBlocks: (blocks: Omit<Block, 'id'>[]) => string[];
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlocks: (updates: { id: string, updates: Partial<Block> }[]) => void;
  deleteSelected: () => void;
  selectBlock: (id: string, multi?: boolean) => void;
  selectTrack: (id: string, multi?: boolean) => void;
  selectGroupRect: (id: string, multi?: boolean) => void;
  selectAll: () => void;
  selectAllBlocks: () => void;
  clearSelection: () => void;
  mutateBlocks: (
    targetIds: string[],
    mutator: (block: Block) => Partial<Block>,
    options?: { continuous?: boolean }
  ) => void;

  // Grouping
  groupSelected: () => void;
  ungroupSelected: () => void;
  updateGroup: (id: string, name: string) => void;

  // Group Rects
  addGroupRect: (groupRect: Omit<GroupRect, 'id'>) => string;
  updateGroupRect: (id: string, updates: Partial<GroupRect>) => void;
  removeGroupRect: (id: string) => void;

  // Clipboard
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;

  // View & UI
  updateCamera: (camera: Partial<CameraState>) => void;
  setTheme: (theme: Theme) => void;
  setGridConfig: (config: { showGrid?: boolean; snapToGrid?: boolean }) => void;
  setPianoKeysCount: (count: number) => void;
  setBlockOpacity: (opacity: number) => void;
  setMouseSensitivity: (sensitivity: number) => void;
  setMasterVolume: (volume: number) => void;
  openContextMenu: (menu: { x: number, y: number, blockId: string }) => void;
  closeContextMenu: () => void;
  toggleContextMenu: (menu: { x: number, y: number, blockId: string }) => void;
  togglePiano: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  toggleOutliner: () => void;
  togglePocketCanvas: () => void;
  toggleTutorial: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  setPocketBlocks: (blocks: Block[]) => void;
  updatePocketBlock: (id: string, updates: Partial<Block>) => void;
  setArrangedPocketBlocks: (blocks: Block[]) => void;
  setPocketSortMode: (mode: 'pitch' | 'time') => void;
  selectPocketBlock: (id: string, multi?: boolean) => void;
  clearPocketSelection: () => void;
  selectAllPocketBlocks: () => void;
  copyPocketSelectedToMain: () => void;
  setHoveredBlockId: (id: string | null) => void;
  setHoveredGroupRectId: (id: string | null) => void;
  updatePocketCamera: (camera: Partial<CameraState>) => void;
  setInteractionContext: (context: 'main' | 'pocket') => void;
  setActivePocketDrag: (drag: { offsetX: number, offsetY: number, blocks: Block[], clickedBlockId: string, initialX?: number, initialY?: number } | null) => void;
  setDisplaySettings: (settings: Partial<{ showGroupName: boolean, showBlockPitch: boolean, showBlockVolume: boolean, showBlockInstrument: boolean }>) => void;

  // Track & Playback Actions
  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  togglePlay: () => void;
  stopPlay: () => void;
  playTrack: (id: string) => void;
  pauseTrack: (id: string) => void;
  stopTrack: (id: string) => void;
  setMode: (mode: Mode) => void;
  setEditingTrackId: (id: string | null) => void;
  setActiveTrackId: (id: string | null) => void;
  setActiveNodeDrag: (state: { trackId: string, nodeId: string, isNewNode?: boolean } | null) => void;
  addTrackNode: (trackId: string, node: Omit<TrackNode, 'id'>) => string;
  insertTrackNode: (trackId: string, index: number, node: Omit<TrackNode, 'id'>) => string;
  removeTrackNode: (trackId: string, nodeId: string) => void;
  updateTrackNode: (trackId: string, nodeId: string, updates: Partial<TrackNode>) => void;
  setRunners: (runners: Runner[]) => void;

  // Macro Recording
  isRecording: boolean;
  recordedEvents: { time: number; type: 'block' | 'groupRect'; targetId: string }[];
  recordingStartTime: number | null;
  startRecording: () => void;
  stopRecording: () => void;
  recordEvent: (type: 'block' | 'groupRect', targetId: string) => void;
  clearRecordedEvents: () => void;

  // Game Mode State
  gameState: 'upload' | 'arrange' | 'play' | 'paused' | 'result';
  gameFileName: string | null;
  gameBlocks: Block[];
  gameSpeed: number;
  gameEvents: { time: number; pitch: string; instrument: string; blockId: string; }[];
  gameScore: number;
  gameCombo: number;
  perfectCount: number;
  goodCount: number;
  badCount: number;
  missCount: number;
  wrongCount: number;
  maxCombo: number;
  gameResetCount: number;
  setGameState: (state: AppState['gameState']) => void;
  setGameFileName: (name: string | null) => void;
  setGameBlocks: (blocks: Block[]) => void;
  updateGameBlock: (id: string, updates: Partial<Block>) => void;
  setGameEvents: (events: AppState['gameEvents']) => void;
  setGameStats: (stats: Partial<{ gameScore: number, gameCombo: number, perfectCount: number, goodCount: number, badCount: number, missCount: number, wrongCount: number, maxCombo: number, latestHit: HitEvent | null }>) => void;
  setGameSpeed: (speed: number) => void;
  mobileControlMode: 'crosshair' | 'touch';
  setMobileControlMode: (mode: 'crosshair' | 'touch') => void;
  resetGamePlay: () => void;
  latestHit: HitEvent | null;
  gameAudioUrl: string | null;
  setGameAudioUrl: (url: string | null) => void;
  gameAudioVolume: number;
  setGameAudioVolume: (v: number) => void;
  
  gameCamera: { x: number; y: number; zoom: number };
  updateGameCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;

  levelMetadata: {
    title?: string;
    author?: string;
    description?: string;
    midiCredit?: string;
  } | null;
  setLevelMetadata: (metadata: AppState['levelMetadata']) => void;

  latestPerformHit: { time: number, color: number } | null;
  setLatestPerformHit: (hit: { time: number, color: number }) => void;
  
  toastMessage: { text: string; id: number } | null;
  showToast: (msg: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const useStore = create<AppState>()(
  temporal(
    persist(
      (set, get) => ({
        blocks: [
          { id: '1', x: 200, y: 200, pitch: 'C4', volume: 1, instrument: 'piano', keyBinding: 'a' },
          { id: '2', x: 300, y: 250, pitch: 'E4', volume: 1, instrument: 'piano', keyBinding: 's' },
          { id: '3', x: 400, y: 200, pitch: 'G4', volume: 1, instrument: 'piano', keyBinding: 'd' }
        ],
        groups: [],
        groupRects: [],
        tracks: [],
        runners: [],
        selectedBlockIds: [],
        selectedTrackIds: [],
        selectedGroupRectIds: [],
        clipboardBlocks: [],
        clipboardTracks: [],
        clipboardGroupRects: [],
        camera: { x: 0, y: 0, zoom: 1 },
        theme: getSystemTheme(),
        showGrid: true,
        snapToGrid: true,
        isPianoOpen: false,
        isSettingsOpen: false,
        isHelpOpen: false,
        isOutlinerOpen: false,
        isPocketCanvasOpen: false,
        isTutorialOpen: false,
        searchQuery: '',
        isSearchOpen: false,
        pocketBlocks: [],
        arrangedPocketBlocks: [],
        pocketSortMode: 'pitch',
        selectedPocketBlockIds: [],
        pocketCamera: { x: 0, y: 0, zoom: 1 },
        interactionContext: 'main',
        activePocketDrag: null,

        showGroupName: true,
        showBlockPitch: true,
        showBlockVolume: true,
        showBlockInstrument: true,

        hoveredBlockId: null,
        hoveredGroupRectId: null,
        activeNodeDrag: null,

        isPlaying: false,
        trackPlaybackStatus: {},
        mode: 'select',
        editingTrackId: null,
        activeTrackId: null,

        pianoKeysCount: 36,
        blockOpacity: 1,
        mouseSensitivity: 1,
        masterVolume: 1,
        contextMenu: null,

        lastSelectedId: null,
        lastSelectedType: null,

        isRecording: false,
        recordedEvents: [],
        recordingStartTime: null,

        gameState: 'upload',
        gameFileName: null,
        gameBlocks: [],
        gameSpeed: 1,
        gameEvents: [],
        gameScore: 0,
        gameCombo: 0,
        perfectCount: 0,
        goodCount: 0,
        badCount: 0,
        missCount: 0,
        wrongCount: 0,
        maxCombo: 0,
        gameResetCount: 0,
        mobileControlMode: 'touch',
        levelMetadata: null,
        gameAudioUrl: null,
        gameAudioVolume: 1,
        
        gameCamera: { x: 0, y: 0, zoom: 1 },

        toastMessage: null,

        addBlock: (block) => {
          const id = generateId();
          set((state) => ({
            blocks: [...state.blocks, { ...block, playedAt: Date.now(), playedVolumeMultiplier: 1, id }]
          }));
          return id;
        },

        addBlocks: (newBlocks) => {
          const blocksWithIds = newBlocks.map(b => ({ ...b, id: (b as Block).id || generateId(), playedAt: Date.now(), playedVolumeMultiplier: 1 }));
          set((state) => ({
            blocks: [...state.blocks, ...blocksWithIds]
          }));
          return blocksWithIds.map(b => b.id);
        },

        removeBlock: (id) => set((state) => ({
          blocks: state.blocks.filter((b) => b.id !== id),
          selectedBlockIds: state.selectedBlockIds.filter((selId) => selId !== id)
        })),

        updateBlock: (id, updates) => set((state) => {
          if (updates.playedAt !== undefined) {
             get().recordEvent('block', id);
          }
          if (state.blocks.some(b => b.id === id)) {
            return { blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b) };
          }
          if (state.gameBlocks.some(b => b.id === id)) {
            return { gameBlocks: state.gameBlocks.map(b => b.id === id ? { ...b, ...updates } : b) };
          }
          return state;
        }),

        updateBlocks: (updates) => set((state) => {
          const updateMap = new Map(updates.map(u => [u.id, u.updates]));
          
          updates.forEach(u => {
            if (u.updates.playedAt !== undefined) {
              get().recordEvent('block', u.id);
            }
          });

          const newState: Partial<AppState> = {
            blocks: state.blocks.map(b => updateMap.has(b.id) ? { ...b, ...updateMap.get(b.id)! } : b),
            gameBlocks: state.gameBlocks.map(b => updateMap.has(b.id) ? { ...b, ...updateMap.get(b.id)! } : b)
          };
          if (updates.length === 1) {
            const u = updates[0].updates;
            if (u.pitch !== undefined || u.volume !== undefined || u.instrument !== undefined || u.keyBinding !== undefined) {
               newState.lastSelectedId = updates[0].id;
               newState.lastSelectedType = 'block';
            }
          }
          return newState as AppState;
        }),

        deleteSelected: () => set((state) => {
          const blocksToRemove = state.blocks.filter((b) => state.selectedBlockIds.includes(b.id));
          let gameBlocksToRemove = state.gameBlocks.filter((b) => state.selectedBlockIds.includes(b.id));

          // Condition: "只能刪有一個以上同樣音調的" (Only delete if > 1 block of same pitch), UNLESS it's invalid (not in MIDI)
          if (gameBlocksToRemove.length > 0) {
            const pitchCounts = new Map<string, number>();
            state.gameBlocks.forEach(b => {
              const key = `${b.pitch}-${b.instrument || 'piano'}`;
              pitchCounts.set(key, (pitchCounts.get(key) || 0) + 1);
            });
            
            // Try to get editor state to check validity
            let editorState: { midiData: { tracks: { instrument: string, notes: { name: string }[] }[] } } | null = null;
            const isEditor = isLevelEditor();
            if (isEditor) {
              try {
                editorState = (window as { levelEditorStore?: { getState: () => { midiData: { tracks: { instrument: string, notes: { name: string }[] }[] } } } }).levelEditorStore?.getState() || null;
              } catch {
                // Ignore error
              }
            }

            gameBlocksToRemove = gameBlocksToRemove.filter(b => {
              let isInvalid = false;
              if (editorState && editorState.midiData) {
                isInvalid = true;
                const bInst = b.instrument || 'piano';
                for (const track of editorState.midiData.tracks) {
                  if (track.instrument === bInst) {
                    if (track.notes.some((n) => n.name === b.pitch)) {
                      isInvalid = false;
                      break;
                    }
                  }
                }
              }

              if (isInvalid) return true;

              const key = `${b.pitch}-${b.instrument || 'piano'}`;
              const count = pitchCounts.get(key) || 0;
              if (count > 1) {
                pitchCounts.set(key, count - 1);
                return true;
              }
              return false;
            });
          }

          const idsToRemove = [...blocksToRemove.map(b=>b.id), ...gameBlocksToRemove.map(b=>b.id)];

          return {
            blocks: state.blocks.filter((b) => !idsToRemove.includes(b.id)),
            gameBlocks: state.gameBlocks.filter((b) => !idsToRemove.includes(b.id)),
            selectedBlockIds: state.selectedBlockIds.filter(id => !idsToRemove.includes(id)),
            tracks: state.tracks.filter(t => !state.selectedTrackIds.includes(t.id)),
            runners: state.runners.filter(r => !state.selectedTrackIds.includes(r.trackId)),
            selectedTrackIds: [],
            groupRects: state.groupRects.filter(g => !state.selectedGroupRectIds.includes(g.id)),
            selectedGroupRectIds: []
          };
        }),

        selectBlock: (id, multi) => set((state) => {
          const item = state.blocks.find(b => b.id === id) || state.gameBlocks.find(b => b.id === id);
          const groupId = item?.groupId;
          const targetBlockIds = groupId 
            ? [...state.blocks.filter(b => b.groupId === groupId).map(b => b.id), ...state.gameBlocks.filter(b => b.groupId === groupId).map(b => b.id)] 
            : [id];
          const targetTrackIds = groupId ? state.tracks.filter(t => t.groupId === groupId).map(t => t.id) : [];
          const targetGroupRectIds = groupId ? state.groupRects.filter(g => g.groupId === groupId).map(g => g.id) : [];

          if (multi) {
            const isSelected = state.selectedBlockIds.includes(id);
            return {
              selectedBlockIds: isSelected
                ? state.selectedBlockIds.filter((selId) => !targetBlockIds.includes(selId))
                : [...new Set([...state.selectedBlockIds, ...targetBlockIds])],
              selectedTrackIds: isSelected
                ? state.selectedTrackIds.filter((selId) => !targetTrackIds.includes(selId))
                : [...new Set([...state.selectedTrackIds, ...targetTrackIds])],
              selectedGroupRectIds: isSelected
                ? state.selectedGroupRectIds.filter((selId) => !targetGroupRectIds.includes(selId))
                : [...new Set([...state.selectedGroupRectIds, ...targetGroupRectIds])],
              activeTrackId: null,
              editingTrackId: null,
              lastSelectedId: id,
              lastSelectedType: 'block',
              interactionContext: 'main'
            };
          }
          return { selectedBlockIds: targetBlockIds, selectedTrackIds: targetTrackIds, selectedGroupRectIds: targetGroupRectIds, activeTrackId: null, editingTrackId: null, lastSelectedId: id, lastSelectedType: 'block', interactionContext: 'main' };
        }),

        selectTrack: (id, multi) => set((state) => {
          const item = state.tracks.find(t => t.id === id);
          const groupId = item?.groupId;
          const targetBlockIds = groupId ? state.blocks.filter(b => b.groupId === groupId).map(b => b.id) : [];
          const targetTrackIds = groupId ? state.tracks.filter(t => t.groupId === groupId).map(t => t.id) : [id];
          const targetGroupRectIds = groupId ? state.groupRects.filter(g => g.groupId === groupId).map(g => g.id) : [];

          if (multi) {
            const isSelected = state.selectedTrackIds.includes(id);
            return {
              selectedBlockIds: isSelected
                ? state.selectedBlockIds.filter(selId => !targetBlockIds.includes(selId))
                : [...new Set([...state.selectedBlockIds, ...targetBlockIds])],
              selectedTrackIds: isSelected
                ? state.selectedTrackIds.filter(tId => !targetTrackIds.includes(tId))
                : [...new Set([...state.selectedTrackIds, ...targetTrackIds])],
              selectedGroupRectIds: isSelected
                ? state.selectedGroupRectIds.filter(selId => !targetGroupRectIds.includes(selId))
                : [...new Set([...state.selectedGroupRectIds, ...targetGroupRectIds])],
              activeTrackId: id,
              lastSelectedId: id,
              lastSelectedType: 'track',
              interactionContext: 'main'
            };
          }
          return { selectedTrackIds: targetTrackIds, selectedBlockIds: targetBlockIds, selectedGroupRectIds: targetGroupRectIds, activeTrackId: id, lastSelectedId: id, lastSelectedType: 'track', interactionContext: 'main' };
        }),

        selectGroupRect: (id, multi) => set((state) => {
          const item = state.groupRects.find(g => g.id === id);
          const groupId = item?.groupId;
          const targetBlockIds = groupId ? state.blocks.filter(b => b.groupId === groupId).map(b => b.id) : [];
          const targetTrackIds = groupId ? state.tracks.filter(t => t.groupId === groupId).map(t => t.id) : [];
          const targetGroupRectIds = groupId ? state.groupRects.filter(g => g.groupId === groupId).map(g => g.id) : [id];

          if (multi) {
            const isSelected = state.selectedGroupRectIds.includes(id);
            return {
              selectedBlockIds: isSelected
                ? state.selectedBlockIds.filter(selId => !targetBlockIds.includes(selId))
                : [...new Set([...state.selectedBlockIds, ...targetBlockIds])],
              selectedTrackIds: isSelected
                ? state.selectedTrackIds.filter(selId => !targetTrackIds.includes(selId))
                : [...new Set([...state.selectedTrackIds, ...targetTrackIds])],
              selectedGroupRectIds: isSelected
                ? state.selectedGroupRectIds.filter(gId => !targetGroupRectIds.includes(gId))
                : [...new Set([...state.selectedGroupRectIds, ...targetGroupRectIds])],
              lastSelectedId: id,
              lastSelectedType: 'groupRect',
              interactionContext: 'main'
            };
          }
          return { selectedGroupRectIds: targetGroupRectIds, selectedBlockIds: targetBlockIds, selectedTrackIds: targetTrackIds, lastSelectedId: id, lastSelectedType: 'groupRect', interactionContext: 'main' };
        }),

        selectAll: () => set((state) => {
          if (state.selectedGroupRectIds.length > 0) {
            const selectedRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
            
            const isInside = (x: number, y: number, w: number = 60, h: number = 60) => {
              return selectedRects.some(g => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y);
            };

            const targetBlocks = state.gameState === 'arrange' ? state.gameBlocks : state.blocks;
            const blockIds = targetBlocks.filter(b => isInside(b.x, b.y)).map(b => b.id);
            const trackIds = state.tracks.filter(t => t.nodes.some(n => isInside(n.x, n.y, 10, 10))).map(t => t.id);
            const groupRectIds = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id) || isInside(g.x, g.y, g.w, g.h)).map(g => g.id);

            return {
              selectedBlockIds: blockIds,
              selectedTrackIds: trackIds,
              selectedGroupRectIds: groupRectIds,
              activeTrackId: null,
              editingTrackId: null
            };
          }

          return {
            selectedBlockIds: state.gameState === 'arrange' ? state.gameBlocks.map(b => b.id) : state.blocks.map(b => b.id),
            selectedTrackIds: state.tracks.map(t => t.id),
            selectedGroupRectIds: state.groupRects.map(g => g.id),
            activeTrackId: null,
            editingTrackId: null
          };
        }),

        selectAllBlocks: () => set((state) => {
          if (state.selectedGroupRectIds.length > 0) {
            const selectedRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
            
            const isInside = (x: number, y: number, w: number = 60, h: number = 60) => {
              return selectedRects.some(g => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y);
            };

            const targetBlocks = state.gameState === 'arrange' ? state.gameBlocks : state.blocks;
            const blockIds = targetBlocks.filter(b => isInside(b.x, b.y)).map(b => b.id);

            return {
              selectedBlockIds: blockIds,
              selectedTrackIds: [],
              selectedGroupRectIds: state.selectedGroupRectIds,
              activeTrackId: null,
              editingTrackId: null
            };
          }

          return {
            selectedBlockIds: state.gameState === 'arrange' ? state.gameBlocks.map(b => b.id) : state.blocks.map(b => b.id),
            selectedTrackIds: [],
            selectedGroupRectIds: [],
            activeTrackId: null,
            editingTrackId: null
          };
        }),

        clearSelection: () => set({ selectedBlockIds: [], selectedTrackIds: [], selectedGroupRectIds: [], activeTrackId: null, editingTrackId: null, interactionContext: 'main' }),

        mutateBlocks: (targetIds, mutator, options) => {
          const state = get();

          let finalTargetIds = [...targetIds];
          const hasSelected = targetIds.some(id => state.selectedBlockIds.includes(id));
          if (hasSelected && state.selectedBlockIds.length > 0) {
            finalTargetIds = [...new Set([...targetIds, ...state.selectedBlockIds])];
          }

          const updates = finalTargetIds.map(id => {
            const block = state.blocks.find(b => b.id === id) || state.gameBlocks.find(b => b.id === id);
            if (!block) return null;
            return { id, updates: mutator(block) };
          }).filter(Boolean) as { id: string, updates: Partial<Block> }[];

          if (updates.length === 0) return;

          if (options?.continuous) {
            if (!isHistoryPausedForContinuous) {
              useStore.temporal.setState(s => ({
                pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks, gameBlocks: state.gameBlocks }],
                futureStates: []
              }));
              useStore.temporal.getState().pause();
              isHistoryPausedForContinuous = true;
            }
            if (historyDebounceTimer) {
              clearTimeout(historyDebounceTimer);
            }
            historyDebounceTimer = setTimeout(() => {
              useStore.temporal.getState().resume();
              isHistoryPausedForContinuous = false;
              historyDebounceTimer = null;
            }, 500);
          }

          get().updateBlocks(updates);
        },

        groupSelected: () => set((state) => {
          if (state.selectedBlockIds.length + state.selectedTrackIds.length + state.selectedGroupRectIds.length < 2) return state;
          const groupId = generateId();
          const newGroup: Group = { id: groupId, name: `Group ${state.groups.length + 1}` };
          get().showToast('已建立群組 (Group Created)');
          return {
            groups: [...state.groups, newGroup],
            blocks: state.blocks.map(b =>
              state.selectedBlockIds.includes(b.id) ? { ...b, groupId } : b
            ),
            gameBlocks: state.gameBlocks.map(b =>
              state.selectedBlockIds.includes(b.id) ? { ...b, groupId } : b
            ),
            tracks: state.tracks.map(t =>
              state.selectedTrackIds.includes(t.id) ? { ...t, groupId } : t
            ),
            groupRects: state.groupRects.map(g =>
              state.selectedGroupRectIds.includes(g.id) ? { ...g, groupId } : g
            )
          };
        }),

        ungroupSelected: () => set((state) => {
          // Find groups of selected objects
          const groupIdsToRemove = new Set([
            ...state.blocks.filter(b => state.selectedBlockIds.includes(b.id) && b.groupId).map(b => b.groupId),
            ...state.gameBlocks.filter(b => state.selectedBlockIds.includes(b.id) && b.groupId).map(b => b.groupId),
            ...state.tracks.filter(t => state.selectedTrackIds.includes(t.id) && t.groupId).map(t => t.groupId),
            ...state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id) && g.groupId).map(g => g.groupId)
          ]);
          if (groupIdsToRemove.size === 0) return state;
          
          get().showToast('已解散群組 (Group Dissolved)');
          return {
            blocks: state.blocks.map(b =>
              b.groupId && groupIdsToRemove.has(b.groupId) ? { ...b, groupId: undefined } : b
            ),
            gameBlocks: state.gameBlocks.map(b =>
              b.groupId && groupIdsToRemove.has(b.groupId) ? { ...b, groupId: undefined } : b
            ),
            tracks: state.tracks.map(t =>
              t.groupId && groupIdsToRemove.has(t.groupId) ? { ...t, groupId: undefined } : t
            ),
            groupRects: state.groupRects.map(g =>
              g.groupId && groupIdsToRemove.has(g.groupId) ? { ...g, groupId: undefined } : g
            ),
            groups: state.groups.filter(g => !groupIdsToRemove.has(g.id))
          };
        }),

        updateGroup: (id, name) => set((state) => ({
          groups: state.groups.map(g => g.id === id ? { ...g, name } : g)
        })),

        addGroupRect: (groupRect) => {
          const id = generateId();
          const name = groupRect.name || `Group ${get().groupRects.length + 1}`;
          set((state) => ({ groupRects: [...state.groupRects, { enabled: true, ...groupRect, name, id }] }));
          return id;
        },
        updateGroupRect: (id, updates) => set((state) => {
          if (updates.playedAt !== undefined) {
            get().recordEvent('groupRect', id);
          }
          const newState: Partial<AppState> = {
             groupRects: state.groupRects.map(g => g.id === id ? { ...g, ...updates } : g)
          };
          if (updates.name !== undefined || updates.volume !== undefined || updates.keyBinding !== undefined || updates.w !== undefined || updates.h !== undefined || updates.enabled !== undefined) {
             newState.lastSelectedId = id;
             newState.lastSelectedType = 'groupRect';
          }
          return newState as AppState;
        }),
        removeGroupRect: (id) => set((state) => ({
          groupRects: state.groupRects.filter(g => g.id !== id)
        })),

        copySelected: () => {
          const state = get();
          if (state.interactionContext === 'pocket') {
            const blocksToCopy = state.arrangedPocketBlocks
                .filter(b => state.selectedPocketBlockIds.includes(b.id))
                .map((b) => ({
                    ...b,
                    x: b.xOffset || 0,
                    y: b.yOffset || 0
                }));
            set({ clipboardBlocks: blocksToCopy, clipboardTracks: [], clipboardGroupRects: [] });
            return;
          }
          const blocksToCopy = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
          const gameBlocksToCopy = state.gameBlocks.filter(b => state.selectedBlockIds.includes(b.id));
          const tracksToCopy = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
          const groupRectsToCopy = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
          set({ clipboardBlocks: blocksToCopy.length > 0 ? blocksToCopy : gameBlocksToCopy, clipboardTracks: tracksToCopy, clipboardGroupRects: groupRectsToCopy });
        },

        pasteClipboard: () => set((state) => {
          if (state.clipboardBlocks.length === 0 && state.clipboardTracks.length === 0 && state.clipboardGroupRects.length === 0) return state;
          const newBlocks = state.clipboardBlocks.map(b => ({
            ...b,
            id: generateId(),
            x: b.x + 20, // offset slightly
            y: b.y + 20,
            groupId: undefined // drop group when pasting
          }));
          const newTracks = state.clipboardTracks.map(t => ({
            ...t,
            id: generateId(),
            nodes: t.nodes.map(n => ({
              ...n,
              id: generateId(),
              x: n.x + 20,
              y: n.y + 20
            }))
          }));
          const newGroupRects = state.clipboardGroupRects.map(g => ({
            ...g,
            id: generateId(),
            x: g.x + 20,
            y: g.y + 20
          }));
          
          if (state.gameState === 'arrange') {
             return {
               gameBlocks: [...state.gameBlocks, ...newBlocks],
               selectedBlockIds: newBlocks.map(b => b.id),
             };
          }

          return {
            blocks: [...state.blocks, ...newBlocks],
            selectedBlockIds: newBlocks.map(b => b.id),
            tracks: [...state.tracks, ...newTracks],
            selectedTrackIds: newTracks.map(t => t.id),
            groupRects: [...state.groupRects, ...newGroupRects],
            selectedGroupRectIds: newGroupRects.map(g => g.id),
          };
        }),

        duplicateSelected: () => {
          get().copySelected();
          get().pasteClipboard();
        },

        updateCamera: (cameraUpdates) => set((state) => ({ camera: { ...state.camera, ...cameraUpdates } })),
        setTheme: (theme) => set({ theme }),
        setGridConfig: (config) => set((state) => ({ ...state, ...config })),
        setPianoKeysCount: (count) => set({ pianoKeysCount: count }),
        setBlockOpacity: (opacity) => set({ blockOpacity: opacity }),
        setMouseSensitivity: (mouseSensitivity) => set({ mouseSensitivity }),
        setMasterVolume: (volume) => {
            import('../utils/audio').then(({ setMasterVolume }) => setMasterVolume(volume));
            set({ masterVolume: volume });
        },
        openContextMenu: (menu) => set({ contextMenu: menu }),
        closeContextMenu: () => set({ contextMenu: null }),
        toggleContextMenu: (menu) => set((state) => ({ contextMenu: state.contextMenu?.blockId === menu.blockId ? null : menu })),
        togglePiano: () => set((state) => ({ isPianoOpen: !state.isPianoOpen })),
        toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isHelpOpen: false, isTutorialOpen: false })),
        toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen, isSettingsOpen: false, isTutorialOpen: false })),
        toggleOutliner: () => set((state) => ({ isOutlinerOpen: !state.isOutlinerOpen })),
        togglePocketCanvas: () => set((state) => ({ 
          isPocketCanvasOpen: !state.isPocketCanvasOpen,
          interactionContext: state.isPocketCanvasOpen && state.interactionContext === 'pocket' ? 'main' : state.interactionContext
        })),
        toggleTutorial: () => set((state) => ({ isTutorialOpen: !state.isTutorialOpen, isSettingsOpen: false, isHelpOpen: false })),
        setSearchQuery: (query) => set({ searchQuery: query }),
        setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
        
        setPocketBlocks: (blocks) => set({ pocketBlocks: blocks, selectedPocketBlockIds: [] }),
        updatePocketBlock: (id, updates) => set((state) => {
          if (updates.playedAt !== undefined) {
             get().recordEvent('block', id);
          }
          return { pocketBlocks: state.pocketBlocks.map(b => b.id === id ? { ...b, ...updates } : b) };
        }),
        setArrangedPocketBlocks: (blocks) => set({ arrangedPocketBlocks: blocks }),
        setPocketSortMode: (mode) => set({ pocketSortMode: mode }),
        updatePocketCamera: (cameraUpdates) => set((state) => ({ pocketCamera: { ...state.pocketCamera, ...cameraUpdates } })),
        setInteractionContext: (context) => set({ interactionContext: context }),
        setActivePocketDrag: (drag) => set({ activePocketDrag: drag }),
        selectPocketBlock: (id, multi) => set((state) => {
          const updates: Partial<AppState> = { interactionContext: 'pocket' };
          if (multi) {
            const isSelected = state.selectedPocketBlockIds.includes(id);
            updates.selectedPocketBlockIds = isSelected
                ? state.selectedPocketBlockIds.filter((selId) => selId !== id)
                : [...state.selectedPocketBlockIds, id];
          } else {
            updates.selectedPocketBlockIds = [id];
          }
          return updates;
        }),
        clearPocketSelection: () => set({ selectedPocketBlockIds: [] }),
        selectAllPocketBlocks: () => set((state) => ({ selectedPocketBlockIds: state.pocketBlocks.map(b => b.id) })),
        copyPocketSelectedToMain: () => set((state) => {
          const selectedBlocks = state.pocketBlocks.filter(b => state.selectedPocketBlockIds.includes(b.id));
          if (selectedBlocks.length === 0) return state;

          const newBlocks = selectedBlocks.map(b => ({
            ...b,
            id: generateId(),
            groupId: undefined
          }));

          if (state.gameState === 'arrange') {
            return {
              gameBlocks: [...state.gameBlocks, ...newBlocks],
              selectedBlockIds: newBlocks.map(b => b.id),
              selectedPocketBlockIds: []
            };
          }
          return {
            blocks: [...state.blocks, ...newBlocks],
            selectedBlockIds: newBlocks.map(b => b.id),
            selectedPocketBlockIds: []
          };
        }),
        setHoveredBlockId: (hoveredBlockId) => set({ hoveredBlockId }),
        setHoveredGroupRectId: (hoveredGroupRectId) => set({ hoveredGroupRectId }),
        setDisplaySettings: (settings) => set((state) => ({ ...state, ...settings })),

        addTrack: (track) => {
          const id = generateId();
          set((state) => ({ tracks: [...state.tracks, { enabled: true, ...track, id }] }));
          return id;
        },
        updateTrack: (id, updates) => set((state) => {
          const newState: Partial<AppState> = {
            tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
          };
          if (updates.name !== undefined || updates.bpm !== undefined || updates.loop !== undefined || updates.enabled !== undefined) {
             newState.lastSelectedId = id;
             newState.lastSelectedType = 'track';
          }
          if (updates.enabled === false) {
             const newStatus = { ...state.trackPlaybackStatus };
             delete newStatus[id];
             newState.trackPlaybackStatus = newStatus;
             newState.runners = state.runners.filter(r => r.trackId !== id);
          }
          return newState as AppState;
        }),
        deleteTrack: (id) => set((state) => {
          const newState: Partial<AppState> = {
            tracks: state.tracks.filter(t => t.id !== id),
            runners: state.runners.filter(r => r.trackId !== id)
          };
          if (state.activeTrackId === id) newState.activeTrackId = null;
          return newState as AppState;
        }),
        togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
        stopPlay: () => set({ isPlaying: false, trackPlaybackStatus: {}, runners: [] }),
        playTrack: (id) => set((state) => ({ trackPlaybackStatus: { ...state.trackPlaybackStatus, [id]: 'playing' } })),
        pauseTrack: (id) => set((state) => ({ trackPlaybackStatus: { ...state.trackPlaybackStatus, [id]: 'paused' } })),
        stopTrack: (id) => set((state) => {
          const newStatus = { ...state.trackPlaybackStatus };
          delete newStatus[id];
          return {
            trackPlaybackStatus: newStatus,
            runners: state.runners.filter(r => r.trackId !== id)
          };
        }),
        setMode: (mode) => set((state) => {
          const updates: Partial<AppState> = {
            mode,
            activeTrackId: mode === 'select' ? null : state.activeTrackId,
            selectedBlockIds: mode === 'draw_track' || mode === 'draw_group' || mode === 'play' ? [] : state.selectedBlockIds,
            selectedTrackIds: mode === 'draw_track' || mode === 'draw_group' || mode === 'play' ? [] : state.selectedTrackIds,
            selectedGroupRectIds: mode === 'draw_track' || mode === 'draw_group' || mode === 'play' ? [] : state.selectedGroupRectIds,
          };

          if (mode === 'play') {
             updates.contextMenu = null;
             // Record all UI states before entering play mode
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
             // Hide UI panels in play mode
             updates.isPianoOpen = false;
             updates.isSettingsOpen = false;
             updates.isHelpOpen = false;
             updates.isOutlinerOpen = false;
             updates.isSearchOpen = false;
          } else {
             // Handle normal mode transitions
             updates.isPianoOpen = mode === 'piano';
             updates.isSettingsOpen = false;
             updates.isHelpOpen = false;
             
             // Restore UI states if exiting play mode
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

          return updates as AppState;
        }),
        setEditingTrackId: (editingTrackId) => set({ editingTrackId }),
        setActiveTrackId: (activeTrackId) => set({ activeTrackId, selectedBlockIds: [], selectedTrackIds: activeTrackId ? [activeTrackId] : [], selectedGroupRectIds: [] }),
        setActiveNodeDrag: (activeNodeDrag) => set({ activeNodeDrag: activeNodeDrag }),
        addTrackNode: (trackId, node) => {
          let id = generateId();
          set((state) => ({
            tracks: state.tracks.map(t => {
              if (t.id === trackId) {
                if (t.nodes.length > 0) {
                  const first = t.nodes[0];
                  const last = t.nodes[t.nodes.length - 1];
                  const distToFirst = Math.hypot(first.x - node.x, first.y - node.y);
                  const distToLast = Math.hypot(last.x - node.x, last.y - node.y);

                  if (distToFirst < 1) { id = first.id; return t; }
                  if (distToLast < 1) { id = last.id; return t; }

                  if (distToFirst < distToLast) {
                    return { ...t, nodes: [{ ...node, id }, ...t.nodes] };
                  }
                }
                return { ...t, nodes: [...t.nodes, { ...node, id }] };
              }
              return t;
            })
          }));
          return id;
        },
        insertTrackNode: (trackId, index, node) => {
          const id = generateId();
          set((state) => ({
            tracks: state.tracks.map(t => {
              if (t.id === trackId) {
                const newNodes = [...t.nodes];
                newNodes.splice(index, 0, { ...node, id });
                return { ...t, nodes: newNodes };
              }
              return t;
            })
          }));
          return id;
        },
        removeTrackNode: (trackId, nodeId) => set((state) => {
          let trackBecameEmpty = false;
          const tracks = state.tracks.map(t => {
            if (t.id === trackId) {
              const newNodes = t.nodes.filter(n => n.id !== nodeId);
              if (newNodes.length === 0) trackBecameEmpty = true;
              return { ...t, nodes: newNodes };
            }
            return t;
          });
          
          const newState: Partial<AppState> = { tracks: tracks.filter(t => t.nodes.length > 0) };
          if (trackBecameEmpty && state.activeTrackId === trackId) {
            newState.activeTrackId = null;
          }
          return newState as AppState;
        }),
        updateTrackNode: (trackId, nodeId, updates) => set((state) => ({
          tracks: state.tracks.map(t => t.id === trackId ? {
            ...t,
            nodes: t.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
          } : t)
        })),
        setRunners: (runners) => set({ runners }),

        startRecording: () => set({ isRecording: true, recordingStartTime: Date.now(), recordedEvents: [] }),
        stopRecording: () => set({ isRecording: false, recordingStartTime: null }),
        recordEvent: (type, targetId) => set((state) => {
          if (!state.isRecording || !state.recordingStartTime) return state;
          const time = Date.now() - state.recordingStartTime;
          return { recordedEvents: [...state.recordedEvents, { time, type, targetId }] };
        }),
        clearRecordedEvents: () => set({ recordedEvents: [] }),

        setGameState: (gameState) => set({ gameState }),
        setGameFileName: (gameFileName) => set({ gameFileName }),
        setGameBlocks: (gameBlocks) => set({ gameBlocks }),
        updateGameBlock: (id, updates) => set((state) => ({
           gameBlocks: state.gameBlocks.map(b => b.id === id ? { ...b, ...updates } : b)
        })),
        setGameEvents: (gameEvents) => set({ gameEvents }),
        setGameStats: (stats) => set(state => ({ ...state, ...stats })),
        setGameSpeed: (gameSpeed) => set({ gameSpeed }),
        setMobileControlMode: (mobileControlMode) => set({ mobileControlMode }),
        
        setGameAudioUrl: (url) => set({ gameAudioUrl: url }),
        setGameAudioVolume: (v) => set({ gameAudioVolume: v }),
        
        updateGameCamera: (camera) => set((state) => ({ gameCamera: { ...state.gameCamera, ...camera } })),

        setLevelMetadata: (levelMetadata) => set({ levelMetadata }),
        resetGamePlay: () => set((s) => ({ gameResetCount: s.gameResetCount + 1, gameScore: 0, gameCombo: 0, perfectCount: 0, goodCount: 0, badCount: 0, missCount: 0, wrongCount: 0, maxCombo: 0, latestHit: null })),
        latestHit: null,

        latestPerformHit: null,
        setLatestPerformHit: (hit) => set({ latestPerformHit: hit }),
        
        showToast: (msg) => set({ toastMessage: { text: msg, id: Date.now() } })
      }),
      {
        name: 'ybnote-storage',
        partialize: (state) => ({
          blocks: state.blocks,
          groups: state.groups,
          groupRects: state.groupRects,
          tracks: state.tracks,
          theme: state.theme,
          showGrid: state.showGrid,
          snapToGrid: state.snapToGrid,
          pianoKeysCount: state.pianoKeysCount,
          blockOpacity: state.blockOpacity,
          mouseSensitivity: state.mouseSensitivity,
          masterVolume: state.masterVolume,
          showGroupName: state.showGroupName,
          showBlockPitch: state.showBlockPitch,
          showBlockVolume: state.showBlockVolume,
          showBlockInstrument: state.showBlockInstrument,
          mobileControlMode: state.mobileControlMode,
          camera: state.camera,
          recordedEvents: state.recordedEvents
        }), // only persist these fields
      }
    ),
    {
      partialize: (state) => ({ blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks, gameBlocks: state.gameBlocks }), // track history
      onSave: () => {
        if (typeof window !== 'undefined' && isLevelEditor()) {
          import('./useLevelEditorStore').then(({ useLevelEditorStore }) => {
            useLevelEditorStore.getState().commitHistory();
          });
        }
      },
      equality: (pastState, currentState) => {
        if (pastState.groups !== currentState.groups) {
          return false;
        }
        if (pastState.tracks !== currentState.tracks) {
          // Deep compare tracks to avoid duplicate history entries from unrelated state updates
          if (pastState.tracks.length !== currentState.tracks.length) return false;
          for (let i = 0; i < pastState.tracks.length; i++) {
            const pt = pastState.tracks[i];
            const ct = currentState.tracks[i];
            if (pt === ct) continue;
            if (pt.id !== ct.id || pt.name !== ct.name || pt.bpm !== ct.bpm ||
                pt.loop !== ct.loop || pt.enabled !== ct.enabled) return false;
            if (pt.nodes.length !== ct.nodes.length) return false;
            for (let j = 0; j < pt.nodes.length; j++) {
              const pn = pt.nodes[j];
              const cn = ct.nodes[j];
              if (pn === cn) continue;
              if (pn.id !== cn.id || pn.x !== cn.x || pn.y !== cn.y) return false;
            }
          }
        }
        
        if (pastState.groupRects !== currentState.groupRects) {
          if (pastState.groupRects.length !== currentState.groupRects.length) return false;
          for (let i = 0; i < pastState.groupRects.length; i++) {
            const pg = pastState.groupRects[i];
            const cg = currentState.groupRects[i];
            if (pg === cg) continue;
            if (pg.id !== cg.id || pg.name !== cg.name || pg.x !== cg.x || pg.y !== cg.y ||
                pg.w !== cg.w || pg.h !== cg.h || pg.volume !== cg.volume || pg.keyBinding !== cg.keyBinding || pg.enabled !== cg.enabled) {
              return false;
            }
          }
        }

        if (pastState.blocks === currentState.blocks) return true;
        if (pastState.blocks.length !== currentState.blocks.length) return false;
        for (let i = 0; i < pastState.blocks.length; i++) {
          const pb = pastState.blocks[i];
          const cb = currentState.blocks[i];
          if (pb === cb) continue;
          if (pb.id !== cb.id || pb.x !== cb.x || pb.y !== cb.y || pb.pitch !== cb.pitch ||
            pb.volume !== cb.volume ||
            pb.instrument !== cb.instrument || pb.keyBinding !== cb.keyBinding ||
            pb.groupId !== cb.groupId) {
            return false;
          }
        }
        if (pastState.gameBlocks !== currentState.gameBlocks) {
          if (pastState.gameBlocks.length !== currentState.gameBlocks.length) return false;
          for (let i = 0; i < pastState.gameBlocks.length; i++) {
            const pb = pastState.gameBlocks[i];
            const cb = currentState.gameBlocks[i];
            if (pb === cb) continue;
            if (pb.id !== cb.id || pb.x !== cb.x || pb.y !== cb.y || pb.pitch !== cb.pitch ||
              pb.volume !== cb.volume ||
              pb.instrument !== cb.instrument || pb.keyBinding !== cb.keyBinding ||
              pb.groupId !== cb.groupId) {
              return false;
            }
          }
        }

        return true;
      }
    }
  )
);

export const undoAction = () => {
  const temporal = useStore.temporal.getState();
  if (temporal.pastStates.length === 0) {
    useStore.getState().showToast('Nothing to undo');
    return;
  }
  const past = temporal.pastStates[temporal.pastStates.length - 1];
  const current = useStore.getState();


  let msg = 'Undo: Modify Object';
  if ((past.blocks?.length || 0) < (current.blocks?.length || 0)) msg = 'Undo: Add Note';
  else if ((past.blocks?.length || 0) > (current.blocks?.length || 0)) msg = 'Undo: Delete Note';
  else if ((past.groupRects?.length || 0) < (current.groupRects?.length || 0)) msg = 'Undo: Add Group';
  else if ((past.groupRects?.length || 0) > (current.groupRects?.length || 0)) msg = 'Undo: Delete Group';
  else if ((past.tracks?.length || 0) < (current.tracks?.length || 0)) msg = 'Undo: Add Track';
  else if ((past.tracks?.length || 0) > (current.tracks?.length || 0)) msg = 'Undo: Delete Track';

  temporal.undo();
  useStore.getState().showToast(msg);
};

export const redoAction = () => {
  const temporal = useStore.temporal.getState();
  if (temporal.futureStates.length === 0) {
    useStore.getState().showToast('Nothing to redo');
    return;
  }
  const future = temporal.futureStates[temporal.futureStates.length - 1];
  const current = useStore.getState();
  
  let msg = 'Redo: Modify Object';
  if ((future.blocks?.length || 0) > (current.blocks?.length || 0)) msg = 'Redo: Add Note';
  else if ((future.blocks?.length || 0) < (current.blocks?.length || 0)) msg = 'Redo: Delete Note';
  else if ((future.groupRects?.length || 0) > (current.groupRects?.length || 0)) msg = 'Redo: Add Group';
  else if ((future.groupRects?.length || 0) < (current.groupRects?.length || 0)) msg = 'Redo: Delete Group';
  else if ((future.tracks?.length || 0) > (current.tracks?.length || 0)) msg = 'Redo: Add Track';
  else if ((future.tracks?.length || 0) < (current.tracks?.length || 0)) msg = 'Redo: Delete Track';

  temporal.redo();
  useStore.getState().showToast(msg);
};
