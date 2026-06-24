import type { StoreSlice } from './storeTypes';
import type { Block, Group, GroupRect, CameraState, TrackNode, Track, Runner } from '../types';
import { generateId, updateCanvas } from './utils';
import { isLevelEditor } from '../utils/routeUtils';

let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isHistoryPausedForContinuous = false;

export interface CanvasSlice {
  blocks: Block[];
  editorBlocks: Block[];
  groups: Group[];
  groupRects: GroupRect[];
  editorGroupRects: GroupRect[];
  tracks: Track[];
  editorTracks: Track[];
  runners: Runner[];
  editorRunners: Runner[];

  selectedBlockIds: string[];
  selectedTrackIds: string[];
  selectedGroupRectIds: string[];

  clipboardBlocks: Block[];
  clipboardTracks: Track[];
  clipboardGroupRects: GroupRect[];

  camera: CameraState;
  editorCamera: CameraState;

  hoveredBlockId: string | null;
  hoveredGroupRectId: string | null;
  activeNodeDrag: { trackId: string, nodeId: string, isNewNode?: boolean } | null;

  lastSelectedId: string | null;
  lastSelectedType: 'block' | 'groupRect' | 'track' | null;

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

  groupSelected: () => void;
  ungroupSelected: () => void;
  updateGroup: (id: string, name: string) => void;

  addGroupRect: (groupRect: Omit<GroupRect, 'id'>) => string;
  updateGroupRect: (id: string, updates: Partial<GroupRect>) => void;
  removeGroupRect: (id: string) => void;

  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;

  updateCamera: (camera: Partial<CameraState>) => void;
  setHoveredBlockId: (id: string | null) => void;
  setHoveredGroupRectId: (id: string | null) => void;
  setActiveNodeDrag: (state: { trackId: string, nodeId: string, isNewNode?: boolean } | null) => void;

  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  addTrackNode: (trackId: string, node: Omit<TrackNode, 'id'>) => string;
  insertTrackNode: (trackId: string, index: number, node: Omit<TrackNode, 'id'>) => string;
  removeTrackNode: (trackId: string, nodeId: string) => void;
  updateTrackNode: (trackId: string, nodeId: string, updates: Partial<TrackNode>) => void;
  setRunners: (runners: Runner[]) => void;
}

export const createCanvasSlice: StoreSlice<CanvasSlice> = (set, get) => ({
  blocks: [
    { id: '1', x: 200, y: 200, pitch: 'C4', volume: 1, instrument: 'piano', keyBinding: 'a' },
    { id: '2', x: 300, y: 250, pitch: 'E4', volume: 1, instrument: 'piano', keyBinding: 's' },
    { id: '3', x: 400, y: 200, pitch: 'G4', volume: 1, instrument: 'piano', keyBinding: 'd' }
  ],
  editorBlocks: [],
  groups: [],
  groupRects: [],
  editorGroupRects: [],
  tracks: [],
  editorTracks: [],
  runners: [],
  editorRunners: [],

  selectedBlockIds: [],
  selectedTrackIds: [],
  selectedGroupRectIds: [],

  clipboardBlocks: [],
  clipboardTracks: [],
  clipboardGroupRects: [],

  camera: { x: 0, y: 0, zoom: 1 },
  editorCamera: { x: 0, y: 0, zoom: 1 },

  hoveredBlockId: null,
  hoveredGroupRectId: null,
  activeNodeDrag: null,

  lastSelectedId: null,
  lastSelectedType: null,

  addBlock: (block) => {
    const id = generateId();
    updateCanvas(set, (canvas) => ({
      blocks: [...canvas.blocks, { ...block, playedAt: Date.now(), playedVolumeMultiplier: 1, id }]
    }));
    return id;
  },

  addBlocks: (newBlocks) => {
    const blocksWithIds = newBlocks.map(b => ({ ...b, id: (b as Block).id || generateId(), playedAt: Date.now(), playedVolumeMultiplier: 1 }));
    updateCanvas(set, (canvas) => ({
      blocks: [...canvas.blocks, ...blocksWithIds]
    }));
    return blocksWithIds.map(b => b.id);
  },

  removeBlock: (id) => updateCanvas(set, (canvas) => ({
    blocks: canvas.blocks.filter((b) => b.id !== id),
    selectedBlockIds: canvas.selectedBlockIds.filter((selId) => selId !== id)
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

    const newState: Partial<CanvasSlice & import('./gameSlice').GameSlice> = {
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
    return newState;
  }),

  deleteSelected: () => set((state) => {
    const blocksToRemove = state.blocks.filter((b) => state.selectedBlockIds.includes(b.id));
    let gameBlocksToRemove = state.gameBlocks.filter((b) => state.selectedBlockIds.includes(b.id));

    if (gameBlocksToRemove.length > 0) {
      const pitchCounts = new Map<string, number>();
      state.gameBlocks.forEach(b => {
        const key = `${b.pitch}-${b.instrument || 'piano'}`;
        pitchCounts.set(key, (pitchCounts.get(key) || 0) + 1);
      });

      let editorState: { midiData: { tracks: { instrument: string, notes: { name: string }[] }[] } } | null = null;
      const isEditor = isLevelEditor();
      if (isEditor) {
        const storeWindow = window as Window & typeof globalThis & { levelEditorStore?: { getState: () => { midiData: { tracks: { instrument: string, notes: { name: string }[] }[] } } } };
        editorState = storeWindow.levelEditorStore?.getState() ?? null;
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

    const idsToRemove = [...blocksToRemove.map(b => b.id), ...gameBlocksToRemove.map(b => b.id)];

    return {
      blocks: state.blocks.filter((b) => !idsToRemove.includes(b.id)),
      gameBlocks: state.gameBlocks.filter((b) => !idsToRemove.includes(b.id)),
      selectedBlockIds: state.selectedBlockIds.filter(id => !idsToRemove.includes(id)),
      tracks: state.tracks.filter(t => !state.selectedTrackIds.includes(t.id)),
      editorTracks: state.editorTracks.filter(t => !state.selectedTrackIds.includes(t.id)),
      runners: state.runners.filter(r => !state.selectedTrackIds.includes(r.trackId)),
      editorRunners: state.editorRunners.filter(r => !state.selectedTrackIds.includes(r.trackId)),
      selectedTrackIds: [],
      groupRects: state.groupRects.filter(g => !state.selectedGroupRectIds.includes(g.id)),
      editorGroupRects: state.editorGroupRects.filter(g => !state.selectedGroupRectIds.includes(g.id)),
      selectedGroupRectIds: []
    };
  }),

  selectBlock: (id, multi) => set((state) => {
    const item = state.blocks.find(b => b.id === id) || state.gameBlocks.find(b => b.id === id);
    const groupId = item?.groupId;
    const targetBlockIds = groupId
      ? [...state.blocks.filter(b => b.groupId === groupId).map(b => b.id), ...state.gameBlocks.filter(b => b.groupId === groupId).map(b => b.id)]
      : [id];
    const targetTrackIds = groupId ? [...state.tracks, ...state.editorTracks].filter(t => t.groupId === groupId).map(t => t.id) : [];
    const targetGroupRectIds = groupId ? [...state.groupRects, ...state.editorGroupRects].filter(g => g.groupId === groupId).map(g => g.id) : [];

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
    const item = state.tracks.find(t => t.id === id) || state.editorTracks.find(t => t.id === id);
    const groupId = item?.groupId;
    const targetBlockIds = groupId ? [...state.blocks, ...state.gameBlocks].filter(b => b.groupId === groupId).map(b => b.id) : [];
    const targetTrackIds = groupId ? [...state.tracks, ...state.editorTracks].filter(t => t.groupId === groupId).map(t => t.id) : [id];
    const targetGroupRectIds = groupId ? [...state.groupRects, ...state.editorGroupRects].filter(g => g.groupId === groupId).map(g => g.id) : [];

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
    const item = state.groupRects.find(g => g.id === id) || state.editorGroupRects.find(g => g.id === id);
    const groupId = item?.groupId;
    const targetBlockIds = groupId ? [...state.blocks, ...state.gameBlocks].filter(b => b.groupId === groupId).map(b => b.id) : [];
    const targetTrackIds = groupId ? [...state.tracks, ...state.editorTracks].filter(t => t.groupId === groupId).map(t => t.id) : [];
    const targetGroupRectIds = groupId ? [...state.groupRects, ...state.editorGroupRects].filter(g => g.groupId === groupId).map(g => g.id) : [id];

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
    const isEditor = isLevelEditor();
    const targetGroupRects = isEditor ? state.editorGroupRects : state.groupRects;
    const targetBlocks = isEditor ? state.gameBlocks : state.blocks;
    const targetTracks = isEditor ? state.editorTracks : state.tracks;

    if (state.selectedGroupRectIds.length > 0) {
      const selectedRects = targetGroupRects.filter(g => state.selectedGroupRectIds.includes(g.id));

      const isInside = (x: number, y: number, w: number = 60, h: number = 60) => {
        return selectedRects.some(g => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y);
      };

      const blockIds = targetBlocks.filter(b => isInside(b.x, b.y)).map(b => b.id);
      const trackIds = targetTracks.filter(t => t.nodes.some(n => isInside(n.x, n.y, 10, 10))).map(t => t.id);
      const groupRectIds = targetGroupRects.filter(g => state.selectedGroupRectIds.includes(g.id) || isInside(g.x, g.y, g.w, g.h)).map(g => g.id);

      return {
        selectedBlockIds: blockIds,
        selectedTrackIds: trackIds,
        selectedGroupRectIds: groupRectIds,
        activeTrackId: null,
        editingTrackId: null
      };
    }

    return {
      selectedBlockIds: targetBlocks.map(b => b.id),
      selectedTrackIds: targetTracks.map(t => t.id),
      selectedGroupRectIds: targetGroupRects.map(g => g.id),
      activeTrackId: null,
      editingTrackId: null
    };
  }),

  selectAllBlocks: () => set((state) => {
    const isEditor = isLevelEditor();
    const targetGroupRects = isEditor ? state.editorGroupRects : state.groupRects;
    const targetBlocks = isEditor ? state.gameBlocks : state.blocks;

    if (state.selectedGroupRectIds.length > 0) {
      const selectedRects = targetGroupRects.filter(g => state.selectedGroupRectIds.includes(g.id));

      const isInside = (x: number, y: number, w: number = 60, h: number = 60) => {
        return selectedRects.some(g => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y);
      };
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
      selectedBlockIds: targetBlocks.map(b => b.id),
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
        import('./useStore').then(({ useStore }) => {
          useStore.temporal.setState(s => ({
            pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, editorGroupRects: state.editorGroupRects, tracks: state.tracks, editorTracks: state.editorTracks, gameBlocks: state.gameBlocks }],
            futureStates: []
          }));
          useStore.temporal.getState().pause();
          isHistoryPausedForContinuous = true;

          if (historyDebounceTimer) {
            clearTimeout(historyDebounceTimer);
          }
          historyDebounceTimer = setTimeout(() => {
            useStore.temporal.getState().resume();
            isHistoryPausedForContinuous = false;
            historyDebounceTimer = null;
          }, 500);
        });
      }
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
      editorTracks: state.editorTracks.map(t =>
        state.selectedTrackIds.includes(t.id) ? { ...t, groupId } : t
      ),
      groupRects: state.groupRects.map(g =>
        state.selectedGroupRectIds.includes(g.id) ? { ...g, groupId } : g
      ),
      editorGroupRects: state.editorGroupRects.map(g =>
        state.selectedGroupRectIds.includes(g.id) ? { ...g, groupId } : g
      )
    };
  }),

  ungroupSelected: () => set((state) => {
    const groupIdsToRemove = new Set([
      ...state.blocks.filter(b => state.selectedBlockIds.includes(b.id) && b.groupId).map(b => b.groupId),
      ...state.gameBlocks.filter(b => state.selectedBlockIds.includes(b.id) && b.groupId).map(b => b.groupId),
      ...state.tracks.filter(t => state.selectedTrackIds.includes(t.id) && t.groupId).map(t => t.groupId),
      ...state.editorTracks.filter(t => state.selectedTrackIds.includes(t.id) && t.groupId).map(t => t.groupId),
      ...state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id) && g.groupId).map(g => g.groupId),
      ...state.editorGroupRects.filter(g => state.selectedGroupRectIds.includes(g.id) && g.groupId).map(g => g.groupId)
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
      editorTracks: state.editorTracks.map(t =>
        t.groupId && groupIdsToRemove.has(t.groupId) ? { ...t, groupId: undefined } : t
      ),
      groupRects: state.groupRects.map(g =>
        g.groupId && groupIdsToRemove.has(g.groupId) ? { ...g, groupId: undefined } : g
      ),
      editorGroupRects: state.editorGroupRects.map(g =>
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
    updateCanvas(set, (canvas) => {
      const name = groupRect.name || `Group ${canvas.groupRects.length + 1}`;
      return {
        groupRects: [...canvas.groupRects, { enabled: true, ...groupRect, name, id }]
      };
    });
    return id;
  },

  updateGroupRect: (id, updates) => updateCanvas(set, (canvas, state) => {
    if (updates.playedAt !== undefined) {
      state.recordEvent('groupRect', id);
    }
    const newState: Partial<CanvasSlice> = {
      groupRects: canvas.groupRects.map(g => g.id === id ? { ...g, ...updates } : g)
    };
    if (updates.name !== undefined || updates.volume !== undefined || updates.keyBinding !== undefined || updates.w !== undefined || updates.h !== undefined || updates.enabled !== undefined) {
      newState.lastSelectedId = id;
      newState.lastSelectedType = 'groupRect';
    }
    return newState;
  }),

  removeGroupRect: (id) => updateCanvas(set, (canvas) => ({
    groupRects: canvas.groupRects.filter(g => g.id !== id)
  })),

  copySelected: () => set((state) => {
    if (state.interactionContext === 'pocket') {
      const blocksToCopy = state.arrangedPocketBlocks
        .filter(b => state.selectedPocketBlockIds.includes(b.id))
        .map((b) => ({
          ...b,
          x: b.xOffset || 0,
          y: b.yOffset || 0
        }));
      return { clipboardBlocks: blocksToCopy, clipboardTracks: [], clipboardGroupRects: [] };
    }
    const blocksToCopy = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
    const gameBlocksToCopy = state.gameBlocks.filter(b => state.selectedBlockIds.includes(b.id));
    const isEditor = isLevelEditor();
    const tracksToCopy = (isEditor ? state.editorTracks : state.tracks).filter(t => state.selectedTrackIds.includes(t.id));
    const groupRectsToCopy = (isEditor ? state.editorGroupRects : state.groupRects).filter(g => state.selectedGroupRectIds.includes(g.id));

    return {
      clipboardBlocks: blocksToCopy.length > 0 ? blocksToCopy : gameBlocksToCopy,
      clipboardTracks: tracksToCopy,
      clipboardGroupRects: groupRectsToCopy
    };
  }),

  pasteClipboard: () => set((state) => {
    if (state.clipboardBlocks.length === 0 && state.clipboardTracks.length === 0 && state.clipboardGroupRects.length === 0) return state;
    const newBlocks = state.clipboardBlocks.map(b => ({
      ...b,
      id: generateId(),
      x: b.x + 20,
      y: b.y + 20,
      groupId: undefined
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

    if (isLevelEditor()) {
      return {
        gameBlocks: [...state.gameBlocks, ...newBlocks],
        selectedBlockIds: newBlocks.map(b => b.id),
        editorTracks: [...state.editorTracks, ...newTracks],
        selectedTrackIds: newTracks.map(t => t.id),
        editorGroupRects: [...state.editorGroupRects, ...newGroupRects],
        selectedGroupRectIds: newGroupRects.map(g => g.id),
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

  updateCamera: (cameraUpdates) => set((state) => isLevelEditor() ? { editorCamera: { ...state.editorCamera, ...cameraUpdates } } : { camera: { ...state.camera, ...cameraUpdates } }),
  setHoveredBlockId: (hoveredBlockId) => set({ hoveredBlockId }),
  setHoveredGroupRectId: (hoveredGroupRectId) => set({ hoveredGroupRectId }),
  setActiveNodeDrag: (activeNodeDrag) => set({ activeNodeDrag: activeNodeDrag }),

  addTrack: (track) => {
    const id = generateId();
    updateCanvas(set, (canvas) => ({
      tracks: [...canvas.tracks, { enabled: true, ...track, id }]
    }));
    return id;
  },

  updateTrack: (id, updates) => updateCanvas(set, (canvas, state) => {
    const newState: Partial<CanvasSlice & import('./playbackSlice').PlaybackSlice> = {
      tracks: canvas.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    };
    if (updates.name !== undefined || updates.bpm !== undefined || updates.loop !== undefined || updates.enabled !== undefined) {
      newState.lastSelectedId = id;
      newState.lastSelectedType = 'track';
    }
    if (updates.enabled === false) {
      const newStatus = { ...state.trackPlaybackStatus };
      delete newStatus[id];
      newState.trackPlaybackStatus = newStatus;
      newState.runners = canvas.runners.filter(r => r.trackId !== id);
    }
    return newState;
  }),

  deleteTrack: (id) => updateCanvas(set, (canvas, state) => {
    const newState: Partial<CanvasSlice & import('./playbackSlice').PlaybackSlice> = {
      tracks: canvas.tracks.filter(t => t.id !== id),
      runners: canvas.runners.filter(r => r.trackId !== id)
    };
    if (state.activeTrackId === id) newState.activeTrackId = null;
    return newState;
  }),

  addTrackNode: (trackId, node) => {
    let id = generateId();
    updateCanvas(set, (canvas) => ({
      tracks: canvas.tracks.map(t => {
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
    updateCanvas(set, (canvas) => ({
      tracks: canvas.tracks.map(t => {
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

  removeTrackNode: (trackId, nodeId) => updateCanvas(set, (canvas, state) => {
    let trackBecameEmpty = false;
    const newTracks = canvas.tracks.map(t => {
      if (t.id === trackId) {
        const newNodes = t.nodes.filter(n => n.id !== nodeId);
        if (newNodes.length === 0) trackBecameEmpty = true;
        return { ...t, nodes: newNodes };
      }
      return t;
    });

    const newState: Partial<CanvasSlice & import('./playbackSlice').PlaybackSlice> = {
      tracks: newTracks.filter(t => t.nodes.length > 0)
    };

    if (trackBecameEmpty && state.activeTrackId === trackId) {
      newState.activeTrackId = null;
    }
    return newState;
  }),

  updateTrackNode: (trackId, nodeId, updates) => updateCanvas(set, (canvas) => ({
    tracks: canvas.tracks.map(t => t.id === trackId ? {
      ...t,
      nodes: t.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    } : t)
  })),

  setRunners: (runners) => updateCanvas(set, () => ({ runners })),
});
