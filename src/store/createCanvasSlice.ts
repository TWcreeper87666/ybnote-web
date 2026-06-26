import type { Block, GroupRect, Track, CameraState, Runner, Mode, TrackNode } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PocketDragState = {
  offsetX: number;
  offsetY: number;
  blocks: Block[];
  clickedBlockId: string;
  initialX?: number;
  initialY?: number;
};

export interface CanvasSliceState {
  blocks: Block[];
  groupRects: GroupRect[];
  tracks: Track[];
  runners: Runner[];
  camera: CameraState;
  mode: Mode;
  selectedBlockIds: string[];
  selectedGroupRectIds: string[];
  selectedTrackIds: string[];
  lastSelectedId: string | null;
  lastSelectedType: 'block' | 'groupRect' | 'track' | null;
  hoveredBlockId: string | null;
  hoveredGroupRectId: string | null;
  activeNodeDrag: { trackId: string; nodeId: string; isNewNode?: boolean } | null;
  contextMenu: { x: number; y: number; blockId: string } | null;
  clipboardBlocks: Block[];
  clipboardTracks: Track[];
  clipboardGroupRects: GroupRect[];
  pocketBlocks: Block[];
  arrangedPocketBlocks: Block[];
  pocketSortMode: 'pitch' | 'time';
  selectedPocketBlockIds: string[];
  pocketCamera: CameraState;
  activePocketDrag: PocketDragState | null;
  interactionContext: 'main' | 'pocket';
}

export interface CanvasSliceActions {
  addBlock: (block: Omit<Block, 'id'>) => string;
  addBlocks: (blocks: Omit<Block, 'id'>[]) => string[];
  setBlocks: (blocks: Block[]) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlocks: (updates: { id: string; updates: Partial<Block> }[]) => void;
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
  addGroupRect: (groupRect: Omit<GroupRect, 'id'>) => string;
  updateGroupRect: (id: string, updates: Partial<GroupRect>) => void;
  removeGroupRect: (id: string) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  updateCamera: (camera: Partial<CameraState>) => void;
  updatePocketCamera: (camera: Partial<CameraState>) => void;
  openContextMenu: (menu: { x: number; y: number; blockId: string }) => void;
  closeContextMenu: () => void;
  toggleContextMenu: (menu: { x: number; y: number; blockId: string }) => void;
  setMode: (mode: Mode) => void;
  setHoveredBlockId: (id: string | null) => void;
  setHoveredGroupRectId: (id: string | null) => void;
  setActiveNodeDrag: (state: { trackId: string; nodeId: string; isNewNode?: boolean } | null) => void;
  setRunners: (runners: Runner[]) => void;
  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  addTrackNode: (trackId: string, node: Omit<TrackNode, 'id'>) => string;
  insertTrackNode: (trackId: string, index: number, node: Omit<TrackNode, 'id'>) => string;
  removeTrackNode: (trackId: string, nodeId: string) => void;
  updateTrackNode: (trackId: string, nodeId: string, updates: Partial<TrackNode>) => void;
  setPocketBlocks: (blocks: Block[]) => void;
  updatePocketBlock: (id: string, updates: Partial<Block>) => void;
  setArrangedPocketBlocks: (blocks: Block[]) => void;
  setPocketSortMode: (mode: 'pitch' | 'time') => void;
  selectPocketBlock: (id: string, multi?: boolean) => void;
  clearPocketSelection: () => void;
  selectAllPocketBlocks: () => void;
  copyPocketSelectedToMain: () => void;
  setInteractionContext: (context: 'main' | 'pocket') => void;
  setActivePocketDrag: (drag: PocketDragState | null) => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

export const INITIAL_CANVAS_STATE: CanvasSliceState = {
  blocks: [],
  groupRects: [],
  tracks: [],
  runners: [],
  camera: { x: 0, y: 0, zoom: 1 },
  mode: 'select',
  selectedBlockIds: [],
  selectedGroupRectIds: [],
  selectedTrackIds: [],
  lastSelectedId: null,
  lastSelectedType: null,
  hoveredBlockId: null,
  hoveredGroupRectId: null,
  activeNodeDrag: null,
  contextMenu: null,
  clipboardBlocks: [],
  clipboardTracks: [],
  clipboardGroupRects: [],
  pocketBlocks: [],
  arrangedPocketBlocks: [],
  pocketSortMode: 'pitch',
  selectedPocketBlockIds: [],
  pocketCamera: { x: 0, y: 0, zoom: 1 },
  activePocketDrag: null,
  interactionContext: 'main',
};

// ─── Action Builder ───────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substring(2, 9);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildCanvasActions = <S extends CanvasSliceState>(
  set: (fn: (s: S) => Partial<S>) => void,
  get: () => S
): CanvasSliceActions => ({

  addBlock: (block) => {
    const id = generateId();
    set((state) => ({
      ...state,
      blocks: [...state.blocks, { ...block, playedAt: Date.now(), playedVolumeMultiplier: 1, id }]
    }));
    return id;
  },

  addBlocks: (newBlocks) => {
    const blocksWithIds = newBlocks.map(b => ({
      ...b,
      id: (b as Block).id || generateId(),
      playedAt: Date.now(),
      playedVolumeMultiplier: 1
    }));
    set((state) => ({ ...state, blocks: [...state.blocks, ...blocksWithIds] }));
    return blocksWithIds.map(b => b.id);
  },

  setBlocks: (blocks) => set((state) => ({ ...state, blocks })),

  removeBlock: (id) => set((state) => ({
    ...state,
    blocks: state.blocks.filter((b) => b.id !== id),
    selectedBlockIds: state.selectedBlockIds.filter((selId) => selId !== id)
  })),

  updateBlock: (id, updates) => set((state) => ({
    ...state,
    blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
  })),

  updateBlocks: (updates) => set((state) => {
    const updateMap = new Map(updates.map(u => [u.id, u.updates]));
    const newState: Partial<S> = {
      blocks: state.blocks.map(b => updateMap.has(b.id) ? { ...b, ...updateMap.get(b.id)! } : b),
    } as Partial<S>;
    if (updates.length === 1) {
      const u = updates[0].updates;
      if (u.pitch !== undefined || u.volume !== undefined || u.instrument !== undefined || u.keyBinding !== undefined) {
        newState.lastSelectedId = updates[0].id as unknown as S['lastSelectedId'];
        newState.lastSelectedType = 'block' as unknown as S['lastSelectedType'];
      }
    }
    return newState;
  }),

  deleteSelected: () => set((state) => ({
    ...state,
    blocks: state.blocks.filter((b) => !state.selectedBlockIds.includes(b.id)),
    selectedBlockIds: [],
    tracks: state.tracks.filter(t => !state.selectedTrackIds.includes(t.id)),
    runners: state.runners.filter(r => !state.selectedTrackIds.includes(r.trackId)),
    selectedTrackIds: [],
    groupRects: state.groupRects.filter(g => !state.selectedGroupRectIds.includes(g.id)),
    selectedGroupRectIds: []
  })),

  selectBlock: (id, multi) => set((state) => {
    const item = state.blocks.find(b => b.id === id);
    const groupId = item?.groupId;
    const targetBlockIds = groupId
      ? state.blocks.filter(b => b.groupId === groupId).map(b => b.id)
      : [id];
    const targetTrackIds = groupId ? state.tracks.filter(t => t.groupId === groupId).map(t => t.id) : [];
    const targetGroupRectIds = groupId ? state.groupRects.filter(g => g.groupId === groupId).map(g => g.id) : [];

    if (multi) {
      const isSelected = state.selectedBlockIds.includes(id);
      return {
        ...state,
        selectedBlockIds: isSelected
          ? state.selectedBlockIds.filter((selId) => !targetBlockIds.includes(selId))
          : [...new Set([...state.selectedBlockIds, ...targetBlockIds])],
        selectedTrackIds: isSelected
          ? state.selectedTrackIds.filter((selId) => !targetTrackIds.includes(selId))
          : [...new Set([...state.selectedTrackIds, ...targetTrackIds])],
        selectedGroupRectIds: isSelected
          ? state.selectedGroupRectIds.filter((selId) => !targetGroupRectIds.includes(selId))
          : [...new Set([...state.selectedGroupRectIds, ...targetGroupRectIds])],
        lastSelectedId: id,
        lastSelectedType: 'block' as const,
        interactionContext: 'main' as const
      };
    }
    return {
      ...state,
      selectedBlockIds: targetBlockIds,
      selectedTrackIds: targetTrackIds,
      selectedGroupRectIds: targetGroupRectIds,
      lastSelectedId: id,
      lastSelectedType: 'block' as const,
      interactionContext: 'main' as const
    };
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
        ...state,
        selectedBlockIds: isSelected
          ? state.selectedBlockIds.filter(selId => !targetBlockIds.includes(selId))
          : [...new Set([...state.selectedBlockIds, ...targetBlockIds])],
        selectedTrackIds: isSelected
          ? state.selectedTrackIds.filter(tId => !targetTrackIds.includes(tId))
          : [...new Set([...state.selectedTrackIds, ...targetTrackIds])],
        selectedGroupRectIds: isSelected
          ? state.selectedGroupRectIds.filter(selId => !targetGroupRectIds.includes(selId))
          : [...new Set([...state.selectedGroupRectIds, ...targetGroupRectIds])],
        lastSelectedId: id,
        lastSelectedType: 'track' as const,
        interactionContext: 'main' as const
      };
    }
    return {
      ...state,
      selectedTrackIds: targetTrackIds,
      selectedBlockIds: targetBlockIds,
      selectedGroupRectIds: targetGroupRectIds,
      lastSelectedId: id,
      lastSelectedType: 'track' as const,
      interactionContext: 'main' as const
    };
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
        ...state,
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
        lastSelectedType: 'groupRect' as const,
        interactionContext: 'main' as const
      };
    }
    return {
      ...state,
      selectedGroupRectIds: targetGroupRectIds,
      selectedBlockIds: targetBlockIds,
      selectedTrackIds: targetTrackIds,
      lastSelectedId: id,
      lastSelectedType: 'groupRect' as const,
      interactionContext: 'main' as const
    };
  }),

  selectAll: () => set((state) => {
    if (state.selectedGroupRectIds.length > 0) {
      const selectedRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
      const isInside = (x: number, y: number, w = 60, h = 60) =>
        selectedRects.some(g => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y);
      return {
        ...state,
        selectedBlockIds: state.blocks.filter(b => isInside(b.x, b.y)).map(b => b.id),
        selectedTrackIds: state.tracks.filter(t => t.nodes.some(n => isInside(n.x, n.y, 10, 10))).map(t => t.id),
        selectedGroupRectIds: state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id) || isInside(g.x, g.y, g.w, g.h)).map(g => g.id),
      };
    }
    return {
      ...state,
      selectedBlockIds: state.blocks.map(b => b.id),
      selectedTrackIds: state.tracks.map(t => t.id),
      selectedGroupRectIds: state.groupRects.map(g => g.id),
    };
  }),

  selectAllBlocks: () => set((state) => {
    if (state.selectedGroupRectIds.length > 0) {
      const selectedRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
      const isInside = (x: number, y: number, w = 60, h = 60) =>
        selectedRects.some(g => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y);
      return {
        ...state,
        selectedBlockIds: state.blocks.filter(b => isInside(b.x, b.y)).map(b => b.id),
        selectedTrackIds: [],
        selectedGroupRectIds: state.selectedGroupRectIds,
      };
    }
    return { ...state, selectedBlockIds: state.blocks.map(b => b.id), selectedTrackIds: [], selectedGroupRectIds: [] };
  }),

  clearSelection: () => set((state) => ({
    ...state,
    selectedBlockIds: [],
    selectedTrackIds: [],
    selectedGroupRectIds: [],
    interactionContext: 'main' as const
  })),

  mutateBlocks: (targetIds, mutator, _options) => {
    const state = get();
    let finalTargetIds = [...targetIds];
    const hasSelected = targetIds.some(id => state.selectedBlockIds.includes(id));
    if (hasSelected && state.selectedBlockIds.length > 0) {
      finalTargetIds = [...new Set([...targetIds, ...state.selectedBlockIds])];
    }
    const updates = finalTargetIds.map(id => {
      const block = state.blocks.find(b => b.id === id);
      if (!block) return null;
      return { id, updates: mutator(block) };
    }).filter(Boolean) as { id: string; updates: Partial<Block> }[];
    if (updates.length > 0) (get() as unknown as CanvasSliceActions).updateBlocks(updates);
  },

  addGroupRect: (groupRect) => {
    const id = generateId();
    const name = groupRect.name || `Group ${get().groupRects.length + 1}`;
    set((state) => ({ ...state, groupRects: [...state.groupRects, { enabled: true, ...groupRect, name, id }] }));
    return id;
  },

  updateGroupRect: (id, updates) => set((state) => {
    const newState: Partial<S> = {
      groupRects: state.groupRects.map(g => g.id === id ? { ...g, ...updates } : g)
    } as Partial<S>;
    if (updates.name !== undefined || updates.volume !== undefined || updates.keyBinding !== undefined ||
        updates.w !== undefined || updates.h !== undefined || updates.enabled !== undefined) {
      newState.lastSelectedId = id as unknown as S['lastSelectedId'];
      newState.lastSelectedType = 'groupRect' as unknown as S['lastSelectedType'];
    }
    return newState;
  }),

  removeGroupRect: (id) => set((state) => ({
    ...state,
    groupRects: state.groupRects.filter(g => g.id !== id)
  })),

  groupSelected: () => set((state) => {
    const totalSelected = state.selectedBlockIds.length + state.selectedTrackIds.length + state.selectedGroupRectIds.length;
    if (totalSelected < 2) return state;
    const groupId = generateId();
    return {
      ...state,
      blocks: state.blocks.map(b => state.selectedBlockIds.includes(b.id) ? { ...b, groupId } : b),
      tracks: state.tracks.map(t => state.selectedTrackIds.includes(t.id) ? { ...t, groupId } : t),
      groupRects: state.groupRects.map(g => state.selectedGroupRectIds.includes(g.id) ? { ...g, groupId } : g),
    };
  }),

  ungroupSelected: () => set((state) => {
    const groupIdsToRemove = new Set<string>([
      ...state.blocks.filter(b => state.selectedBlockIds.includes(b.id) && b.groupId).map(b => b.groupId!),
      ...state.tracks.filter(t => state.selectedTrackIds.includes(t.id) && t.groupId).map(t => t.groupId!),
      ...state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id) && g.groupId).map(g => g.groupId!),
    ]);
    if (groupIdsToRemove.size === 0) return state;
    return {
      ...state,
      blocks: state.blocks.map(b => b.groupId && groupIdsToRemove.has(b.groupId) ? { ...b, groupId: undefined } : b),
      tracks: state.tracks.map(t => t.groupId && groupIdsToRemove.has(t.groupId) ? { ...t, groupId: undefined } : t),
      groupRects: state.groupRects.map(g => g.groupId && groupIdsToRemove.has(g.groupId) ? { ...g, groupId: undefined } : g),
    };
  }),

  copySelected: () => {
    const state = get();
    if (state.interactionContext === 'pocket') {
      const blocksToCopy = state.arrangedPocketBlocks
        .filter(b => state.selectedPocketBlockIds.includes(b.id))
        .map(b => ({ ...b, x: (b as unknown as { xOffset: number }).xOffset || 0, y: (b as unknown as { yOffset: number }).yOffset || 0 }));
      set((s) => ({ ...s, clipboardBlocks: blocksToCopy, clipboardTracks: [], clipboardGroupRects: [] }));
      return;
    }
    const blocksToCopy = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
    const tracksToCopy = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
    const groupRectsToCopy = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
    set((s) => ({ ...s, clipboardBlocks: blocksToCopy, clipboardTracks: tracksToCopy, clipboardGroupRects: groupRectsToCopy }));
  },

  pasteClipboard: () => set((state) => {
    if (state.clipboardBlocks.length === 0 && state.clipboardTracks.length === 0 && state.clipboardGroupRects.length === 0) return state;
    const newBlocks = state.clipboardBlocks.map(b => ({ ...b, id: generateId(), x: b.x + 20, y: b.y + 20, groupId: undefined }));
    const newTracks = state.clipboardTracks.map(t => ({
      ...t, id: generateId(),
      nodes: t.nodes.map(n => ({ ...n, id: generateId(), x: n.x + 20, y: n.y + 20 }))
    }));
    const newGroupRects = state.clipboardGroupRects.map(g => ({ ...g, id: generateId(), x: g.x + 20, y: g.y + 20 }));
    return {
      ...state,
      blocks: [...state.blocks, ...newBlocks],
      selectedBlockIds: newBlocks.map(b => b.id),
      tracks: [...state.tracks, ...newTracks],
      selectedTrackIds: newTracks.map(t => t.id),
      groupRects: [...state.groupRects, ...newGroupRects],
      selectedGroupRectIds: newGroupRects.map(g => g.id),
    };
  }),

  duplicateSelected: () => {
    (get() as unknown as CanvasSliceActions).copySelected();
    (get() as unknown as CanvasSliceActions).pasteClipboard();
  },

  updateCamera: (cameraUpdates) => set((state) => ({ ...state, camera: { ...state.camera, ...cameraUpdates } })),
  updatePocketCamera: (cameraUpdates) => set((state) => ({ ...state, pocketCamera: { ...state.pocketCamera, ...cameraUpdates } })),

  openContextMenu: (menu) => set((state) => ({ ...state, contextMenu: menu })),
  closeContextMenu: () => set((state) => ({ ...state, contextMenu: null })),
  toggleContextMenu: (menu) => set((state) => ({
    ...state,
    contextMenu: state.contextMenu?.blockId === menu.blockId ? null : menu
  })),

  setMode: (mode) => set((state) => {
    const clearOnModeChange = mode === 'draw_track' || mode === 'draw_group' || mode === 'play';
    return {
      ...state,
      mode,
      selectedBlockIds: clearOnModeChange ? [] : state.selectedBlockIds,
      selectedTrackIds: clearOnModeChange ? [] : state.selectedTrackIds,
      selectedGroupRectIds: clearOnModeChange ? [] : state.selectedGroupRectIds,
    };
  }),

  setHoveredBlockId: (hoveredBlockId) => set((state) => ({ ...state, hoveredBlockId })),
  setHoveredGroupRectId: (hoveredGroupRectId) => set((state) => ({ ...state, hoveredGroupRectId })),
  setActiveNodeDrag: (activeNodeDrag) => set((state) => ({ ...state, activeNodeDrag })),
  setRunners: (runners) => set((state) => ({ ...state, runners })),

  addTrack: (track) => {
    const id = generateId();
    set((state) => ({ ...state, tracks: [...state.tracks, { enabled: true, ...track, id }] }));
    return id;
  },

  updateTrack: (id, updates) => set((state) => {
    const newState: Partial<S> = {
      tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    } as Partial<S>;
    if (updates.name !== undefined || updates.bpm !== undefined || updates.loop !== undefined || updates.enabled !== undefined) {
      newState.lastSelectedId = id as unknown as S['lastSelectedId'];
      newState.lastSelectedType = 'track' as unknown as S['lastSelectedType'];
    }
    if (updates.enabled === false) {
      newState.runners = state.runners.filter(r => r.trackId !== id) as unknown as S['runners'];
    }
    return newState;
  }),

  deleteTrack: (id) => set((state) => ({
    ...state,
    tracks: state.tracks.filter(t => t.id !== id),
    runners: state.runners.filter(r => r.trackId !== id),
  })),

  addTrackNode: (trackId, node) => {
    let id = generateId();
    set((state) => ({
      ...state,
      tracks: state.tracks.map(t => {
        if (t.id !== trackId) return t;
        if (t.nodes.length > 0) {
          const first = t.nodes[0];
          const last = t.nodes[t.nodes.length - 1];
          const distToFirst = Math.hypot(first.x - node.x, first.y - node.y);
          const distToLast = Math.hypot(last.x - node.x, last.y - node.y);
          if (distToFirst < 1) { id = first.id; return t; }
          if (distToLast < 1) { id = last.id; return t; }
          if (distToFirst < distToLast) return { ...t, nodes: [{ ...node, id }, ...t.nodes] };
        }
        return { ...t, nodes: [...t.nodes, { ...node, id }] };
      })
    }));
    return id;
  },

  insertTrackNode: (trackId, index, node) => {
    const id = generateId();
    set((state) => ({
      ...state,
      tracks: state.tracks.map(t => {
        if (t.id !== trackId) return t;
        const newNodes = [...t.nodes];
        newNodes.splice(index, 0, { ...node, id });
        return { ...t, nodes: newNodes };
      })
    }));
    return id;
  },

  removeTrackNode: (trackId, nodeId) => set((state) => {
    let trackBecameEmpty = false;
    const tracks = state.tracks.map(t => {
      if (t.id !== trackId) return t;
      const newNodes = t.nodes.filter(n => n.id !== nodeId);
      if (newNodes.length === 0) trackBecameEmpty = true;
      return { ...t, nodes: newNodes };
    });
    const newTracks = tracks.filter(t => t.nodes.length > 0);
    // If the active track (in playground store) became empty, that's handled by playground override
    void trackBecameEmpty;
    return { ...state, tracks: newTracks };
  }),

  updateTrackNode: (trackId, nodeId, updates) => set((state) => ({
    ...state,
    tracks: state.tracks.map(t => t.id === trackId ? {
      ...t, nodes: t.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    } : t)
  })),

  setPocketBlocks: (blocks) => set((state) => ({ ...state, pocketBlocks: blocks, selectedPocketBlockIds: [] })),

  updatePocketBlock: (id, updates) => set((state) => ({
    ...state,
    pocketBlocks: state.pocketBlocks.map(b => b.id === id ? { ...b, ...updates } : b)
  })),

  setArrangedPocketBlocks: (blocks) => set((state) => ({ ...state, arrangedPocketBlocks: blocks })),
  setPocketSortMode: (mode) => set((state) => ({ ...state, pocketSortMode: mode })),
  setInteractionContext: (context) => set((state) => ({ ...state, interactionContext: context })),
  setActivePocketDrag: (drag) => set((state) => ({ ...state, activePocketDrag: drag })),

  selectPocketBlock: (id, multi) => set((state) => {
    const isSelected = state.selectedPocketBlockIds.includes(id);
    const newIds = multi
      ? (isSelected
          ? state.selectedPocketBlockIds.filter(selId => selId !== id)
          : [...state.selectedPocketBlockIds, id])
      : [id];
    return { ...state, interactionContext: 'pocket' as const, selectedPocketBlockIds: newIds };
  }),

  clearPocketSelection: () => set((state) => ({ ...state, selectedPocketBlockIds: [] })),
  selectAllPocketBlocks: () => set((state) => ({ ...state, selectedPocketBlockIds: state.pocketBlocks.map(b => b.id) })),

  copyPocketSelectedToMain: () => set((state) => {
    const selectedBlocks = state.pocketBlocks.filter(b => state.selectedPocketBlockIds.includes(b.id));
    if (selectedBlocks.length === 0) return state;
    const newBlocks = selectedBlocks.map(b => ({ ...b, id: generateId(), groupId: undefined }));
    return { ...state, blocks: [...state.blocks, ...newBlocks], selectedBlockIds: newBlocks.map(b => b.id), selectedPocketBlockIds: [] };
  }),
});
