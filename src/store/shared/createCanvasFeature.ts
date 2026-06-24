import type { Block, Group, GroupRect, Mode, Track } from '../../types';
import { generateId } from './generateId';
import type { CanvasFeature } from './canvasTypes';

/** host store 需額外提供的欄位（playback / pocket / toast 等） */
export interface CanvasFeatureHost extends CanvasFeature {
  activeTrackId?: string | null;
  editingTrackId?: string | null;
  interactionContext?: 'main' | 'pocket';
  trackPlaybackStatus?: Record<string, 'playing' | 'paused'>;
  recordEvent?: (type: 'block' | 'groupRect', targetId: string) => void;
  showToast?: (msg: string) => void;
  /** pocket 複製來源（playground 專用，editor 不傳） */
  arrangedPocketBlocks?: Block[];
  selectedPocketBlockIds?: string[];
}

export interface CreateCanvasFeatureOptions {
  initialBlocks?: Block[];
  /** editor 刪 block 前的 MIDI 驗證過濾 */
  filterBlocksBeforeDelete?: (blocks: Block[], get: () => CanvasFeatureHost) => Block[];
  /** continuous mutate 時的 undo snapshot */
  onContinuousMutateStart?: (snapshot: Pick<CanvasFeature, 'blocks' | 'groups' | 'groupRects' | 'tracks'>) => void;
}

type SetFn = (
  partial:
    | Partial<CanvasFeatureHost>
    | ((state: CanvasFeatureHost) => Partial<CanvasFeatureHost>),
) => void;
type GetFn = () => CanvasFeatureHost;

const defaultBlocks: Block[] = [
  { id: '1', x: 200, y: 200, pitch: 'C4', volume: 1, instrument: 'piano', keyBinding: 'a' },
  { id: '2', x: 300, y: 250, pitch: 'E4', volume: 1, instrument: 'piano', keyBinding: 's' },
  { id: '3', x: 400, y: 200, pitch: 'G4', volume: 1, instrument: 'piano', keyBinding: 'd' },
];

export function createCanvasFeature(
  set: SetFn,
  get: GetFn,
  options: CreateCanvasFeatureOptions = {},
): CanvasFeature {
  const { initialBlocks = defaultBlocks, filterBlocksBeforeDelete, onContinuousMutateStart } =
    options;

  let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isHistoryPausedForContinuous = false;

  return {
    blocks: initialBlocks,
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

    hoveredBlockId: null,
    hoveredGroupRectId: null,
    activeNodeDrag: null,

    lastSelectedId: null,
    lastSelectedType: null,

    // openContextMenu:options.ioen

    addBlock: (block) => {
      const id = generateId();
      set((s) => ({
        blocks: [
          ...s.blocks,
          { ...block, playedAt: Date.now(), playedVolumeMultiplier: 1, id },
        ],
      }));
      return id;
    },

    addBlocks: (newBlocks) => {
      const blocksWithIds = newBlocks.map((b) => ({
        ...b,
        id: (b as Block).id || generateId(),
        playedAt: Date.now(),
        playedVolumeMultiplier: 1,
      }));
      set((s) => ({ blocks: [...s.blocks, ...blocksWithIds] }));
      return blocksWithIds.map((b) => b.id);
    },

    removeBlock: (id) =>
      set((s) => ({
        blocks: s.blocks.filter((b) => b.id !== id),
        selectedBlockIds: s.selectedBlockIds.filter((selId) => selId !== id),
      })),

    updateBlock: (id, updates) => {
      if (updates.playedAt !== undefined) {
        get().recordEvent?.('block', id);
      }
      set((s) => {
        if (!s.blocks.some((b) => b.id === id)) return s;
        return { blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) };
      });
    },

    updateBlocks: (updates) => {
      updates.forEach((u) => {
        if (u.updates.playedAt !== undefined) {
          get().recordEvent?.('block', u.id);
        }
      });
      set((s) => {
        const updateMap = new Map(updates.map((u) => [u.id, u.updates]));
        const newState: Partial<CanvasFeatureHost> = {
          blocks: s.blocks.map((b) =>
            updateMap.has(b.id) ? { ...b, ...updateMap.get(b.id)! } : b,
          ),
        };
        if (updates.length === 1) {
          const u = updates[0].updates;
          if (
            u.pitch !== undefined ||
            u.volume !== undefined ||
            u.instrument !== undefined ||
            u.keyBinding !== undefined
          ) {
            newState.lastSelectedId = updates[0].id;
            newState.lastSelectedType = 'block';
          }
        }
        return newState;
      });
    },

    deleteSelected: () =>
      set((s) => {
        let blocksToRemove = s.blocks.filter((b) => s.selectedBlockIds.includes(b.id));
        if (filterBlocksBeforeDelete) {
          blocksToRemove = filterBlocksBeforeDelete(blocksToRemove, get);
        }
        const idsToRemove = blocksToRemove.map((b) => b.id);

        return {
          blocks: s.blocks.filter((b) => !idsToRemove.includes(b.id)),
          selectedBlockIds: s.selectedBlockIds.filter((id) => !idsToRemove.includes(id)),
          tracks: s.tracks.filter((t) => !s.selectedTrackIds.includes(t.id)),
          runners: s.runners.filter((r) => !s.selectedTrackIds.includes(r.trackId)),
          selectedTrackIds: [],
          groupRects: s.groupRects.filter((g) => !s.selectedGroupRectIds.includes(g.id)),
          selectedGroupRectIds: [],
        };
      }),

    selectBlock: (id, multi) =>
      set((s) => {
        const item = s.blocks.find((b) => b.id === id);
        const groupId = item?.groupId;
        const targetBlockIds = groupId
          ? s.blocks.filter((b) => b.groupId === groupId).map((b) => b.id)
          : [id];
        const targetTrackIds = groupId
          ? s.tracks.filter((t) => t.groupId === groupId).map((t) => t.id)
          : [];
        const targetGroupRectIds = groupId
          ? s.groupRects.filter((g) => g.groupId === groupId).map((g) => g.id)
          : [];

        if (multi) {
          const isSelected = s.selectedBlockIds.includes(id);
          return {
            selectedBlockIds: isSelected
              ? s.selectedBlockIds.filter((selId) => !targetBlockIds.includes(selId))
              : [...new Set([...s.selectedBlockIds, ...targetBlockIds])],
            selectedTrackIds: isSelected
              ? s.selectedTrackIds.filter((selId) => !targetTrackIds.includes(selId))
              : [...new Set([...s.selectedTrackIds, ...targetTrackIds])],
            selectedGroupRectIds: isSelected
              ? s.selectedGroupRectIds.filter((selId) => !targetGroupRectIds.includes(selId))
              : [...new Set([...s.selectedGroupRectIds, ...targetGroupRectIds])],
            activeTrackId: null,
            editingTrackId: null,
            lastSelectedId: id,
            lastSelectedType: 'block',
            interactionContext: 'main',
          };
        }
        return {
          selectedBlockIds: targetBlockIds,
          selectedTrackIds: targetTrackIds,
          selectedGroupRectIds: targetGroupRectIds,
          activeTrackId: null,
          editingTrackId: null,
          lastSelectedId: id,
          lastSelectedType: 'block',
          interactionContext: 'main',
        };
      }),

    selectTrack: (id, multi) =>
      set((s) => {
        const item = s.tracks.find((t) => t.id === id);
        const groupId = item?.groupId;
        const targetBlockIds = groupId
          ? s.blocks.filter((b) => b.groupId === groupId).map((b) => b.id)
          : [];
        const targetTrackIds = groupId
          ? s.tracks.filter((t) => t.groupId === groupId).map((t) => t.id)
          : [id];
        const targetGroupRectIds = groupId
          ? s.groupRects.filter((g) => g.groupId === groupId).map((g) => g.id)
          : [];

        if (multi) {
          const isSelected = s.selectedTrackIds.includes(id);
          return {
            selectedBlockIds: isSelected
              ? s.selectedBlockIds.filter((selId) => !targetBlockIds.includes(selId))
              : [...new Set([...s.selectedBlockIds, ...targetBlockIds])],
            selectedTrackIds: isSelected
              ? s.selectedTrackIds.filter((tId) => !targetTrackIds.includes(tId))
              : [...new Set([...s.selectedTrackIds, ...targetTrackIds])],
            selectedGroupRectIds: isSelected
              ? s.selectedGroupRectIds.filter((selId) => !targetGroupRectIds.includes(selId))
              : [...new Set([...s.selectedGroupRectIds, ...targetGroupRectIds])],
            activeTrackId: id,
            lastSelectedId: id,
            lastSelectedType: 'track',
            interactionContext: 'main',
          };
        }
        return {
          selectedTrackIds: targetTrackIds,
          selectedBlockIds: targetBlockIds,
          selectedGroupRectIds: targetGroupRectIds,
          activeTrackId: id,
          lastSelectedId: id,
          lastSelectedType: 'track',
          interactionContext: 'main',
        };
      }),

    selectGroupRect: (id, multi) =>
      set((s) => {
        const item = s.groupRects.find((g) => g.id === id);
        const groupId = item?.groupId;
        const targetBlockIds = groupId
          ? s.blocks.filter((b) => b.groupId === groupId).map((b) => b.id)
          : [];
        const targetTrackIds = groupId
          ? s.tracks.filter((t) => t.groupId === groupId).map((t) => t.id)
          : [];
        const targetGroupRectIds = groupId
          ? s.groupRects.filter((g) => g.groupId === groupId).map((g) => g.id)
          : [id];

        if (multi) {
          const isSelected = s.selectedGroupRectIds.includes(id);
          return {
            selectedBlockIds: isSelected
              ? s.selectedBlockIds.filter((selId) => !targetBlockIds.includes(selId))
              : [...new Set([...s.selectedBlockIds, ...targetBlockIds])],
            selectedTrackIds: isSelected
              ? s.selectedTrackIds.filter((selId) => !targetTrackIds.includes(selId))
              : [...new Set([...s.selectedTrackIds, ...targetTrackIds])],
            selectedGroupRectIds: isSelected
              ? s.selectedGroupRectIds.filter((gId) => !targetGroupRectIds.includes(gId))
              : [...new Set([...s.selectedGroupRectIds, ...targetGroupRectIds])],
            lastSelectedId: id,
            lastSelectedType: 'groupRect',
            interactionContext: 'main',
          };
        }
        return {
          selectedGroupRectIds: targetGroupRectIds,
          selectedBlockIds: targetBlockIds,
          selectedTrackIds: targetTrackIds,
          lastSelectedId: id,
          lastSelectedType: 'groupRect',
          interactionContext: 'main',
        };
      }),

    selectAll: () =>
      set((s) => {
        if (s.selectedGroupRectIds.length > 0) {
          const selectedRects = s.groupRects.filter((g) =>
            s.selectedGroupRectIds.includes(g.id),
          );
          const isInside = (x: number, y: number, w = 60, h = 60) =>
            selectedRects.some(
              (g) => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y,
            );
          return {
            selectedBlockIds: s.blocks.filter((b) => isInside(b.x, b.y)).map((b) => b.id),
            selectedTrackIds: s.tracks
              .filter((t) => t.nodes.some((n) => isInside(n.x, n.y, 10, 10)))
              .map((t) => t.id),
            selectedGroupRectIds: s.groupRects
              .filter(
                (g) =>
                  s.selectedGroupRectIds.includes(g.id) || isInside(g.x, g.y, g.w, g.h),
              )
              .map((g) => g.id),
            activeTrackId: null,
            editingTrackId: null,
          };
        }
        return {
          selectedBlockIds: s.blocks.map((b) => b.id),
          selectedTrackIds: s.tracks.map((t) => t.id),
          selectedGroupRectIds: s.groupRects.map((g) => g.id),
          activeTrackId: null,
          editingTrackId: null,
        };
      }),

    selectAllBlocks: () =>
      set((s) => {
        if (s.selectedGroupRectIds.length > 0) {
          const selectedRects = s.groupRects.filter((g) =>
            s.selectedGroupRectIds.includes(g.id),
          );
          const isInside = (x: number, y: number, w = 60, h = 60) =>
            selectedRects.some(
              (g) => x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y,
            );
          return {
            selectedBlockIds: s.blocks.filter((b) => isInside(b.x, b.y)).map((b) => b.id),
            selectedTrackIds: [],
            selectedGroupRectIds: s.selectedGroupRectIds,
            activeTrackId: null,
            editingTrackId: null,
          };
        }
        return {
          selectedBlockIds: s.blocks.map((b) => b.id),
          selectedTrackIds: [],
          selectedGroupRectIds: [],
          activeTrackId: null,
          editingTrackId: null,
        };
      }),

    clearSelection: () =>
      set({
        selectedBlockIds: [],
        selectedTrackIds: [],
        selectedGroupRectIds: [],
        activeTrackId: null,
        editingTrackId: null,
        interactionContext: 'main',
      }),

    mutateBlocks: (targetIds, mutator, opts) => {
      const state = get();
      let finalTargetIds = [...targetIds];
      const hasSelected = targetIds.some((id) => state.selectedBlockIds.includes(id));
      if (hasSelected && state.selectedBlockIds.length > 0) {
        finalTargetIds = [...new Set([...targetIds, ...state.selectedBlockIds])];
      }

      const updates = finalTargetIds
        .map((id) => {
          const block = state.blocks.find((b) => b.id === id);
          if (!block) return null;
          return { id, updates: mutator(block) };
        })
        .filter(Boolean) as { id: string; updates: Partial<Block> }[];

      if (updates.length === 0) return;

      if (opts?.continuous && onContinuousMutateStart && !isHistoryPausedForContinuous) {
        onContinuousMutateStart({
          blocks: state.blocks,
          groups: state.groups,
          groupRects: state.groupRects,
          tracks: state.tracks,
        });
        isHistoryPausedForContinuous = true;
        if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
        historyDebounceTimer = setTimeout(() => {
          isHistoryPausedForContinuous = false;
          historyDebounceTimer = null;
        }, 500);
      }

      get().updateBlocks(updates);
    },

    groupSelected: () =>
      set((s) => {
        if (
          s.selectedBlockIds.length + s.selectedTrackIds.length + s.selectedGroupRectIds.length <
          2
        ) {
          return s;
        }
        const groupId = generateId();
        const newGroup: Group = { id: groupId, name: `Group ${s.groups.length + 1}` };
        get().showToast?.('已建立群組 (Group Created)');
        return {
          groups: [...s.groups, newGroup],
          blocks: s.blocks.map((b) =>
            s.selectedBlockIds.includes(b.id) ? { ...b, groupId } : b,
          ),
          tracks: s.tracks.map((t) =>
            s.selectedTrackIds.includes(t.id) ? { ...t, groupId } : t,
          ),
          groupRects: s.groupRects.map((g) =>
            s.selectedGroupRectIds.includes(g.id) ? { ...g, groupId } : g,
          ),
        };
      }),

    ungroupSelected: () =>
      set((s) => {
        const groupIdsToRemove = new Set(
          [
            ...s.blocks
              .filter((b) => s.selectedBlockIds.includes(b.id) && b.groupId)
              .map((b) => b.groupId),
            ...s.tracks
              .filter((t) => s.selectedTrackIds.includes(t.id) && t.groupId)
              .map((t) => t.groupId),
            ...s.groupRects
              .filter((g) => s.selectedGroupRectIds.includes(g.id) && g.groupId)
              .map((g) => g.groupId),
          ].filter(Boolean) as string[],
        );
        if (groupIdsToRemove.size === 0) return s;

        get().showToast?.('已解散群組 (Group Dissolved)');
        return {
          blocks: s.blocks.map((b) =>
            b.groupId && groupIdsToRemove.has(b.groupId) ? { ...b, groupId: undefined } : b,
          ),
          tracks: s.tracks.map((t) =>
            t.groupId && groupIdsToRemove.has(t.groupId) ? { ...t, groupId: undefined } : t,
          ),
          groupRects: s.groupRects.map((g) =>
            g.groupId && groupIdsToRemove.has(g.groupId) ? { ...g, groupId: undefined } : g,
          ),
          groups: s.groups.filter((g) => !groupIdsToRemove.has(g.id)),
        };
      }),

    updateGroup: (id, name) =>
      set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)) })),

    addGroupRect: (groupRect) => {
      const id = generateId();
      set((s) => {
        const name = groupRect.name || `Group ${s.groupRects.length + 1}`;
        return {
          groupRects: [...s.groupRects, { enabled: true, ...groupRect, name, id }],
        };
      });
      return id;
    },

    updateGroupRect: (id, updates) => {
      if (updates.playedAt !== undefined) {
        get().recordEvent?.('groupRect', id);
      }
      set((s) => {
        const newState: Partial<CanvasFeatureHost> = {
          groupRects: s.groupRects.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        };
        if (
          updates.name !== undefined ||
          updates.volume !== undefined ||
          updates.keyBinding !== undefined ||
          updates.w !== undefined ||
          updates.h !== undefined ||
          updates.enabled !== undefined
        ) {
          newState.lastSelectedId = id;
          newState.lastSelectedType = 'groupRect';
        }
        return newState;
      });
    },

    removeGroupRect: (id) =>
      set((s) => ({ groupRects: s.groupRects.filter((g) => g.id !== id) })),

    copySelected: () =>
      set((s) => {
        if (s.interactionContext === 'pocket' && s.arrangedPocketBlocks) {
          const blocksToCopy = s.arrangedPocketBlocks
            .filter((b) => (s.selectedPocketBlockIds ?? []).includes(b.id))
            .map((b) => ({ ...b, x: b.xOffset || 0, y: b.yOffset || 0 }));
          return { clipboardBlocks: blocksToCopy, clipboardTracks: [], clipboardGroupRects: [] };
        }
        return {
          clipboardBlocks: s.blocks.filter((b) => s.selectedBlockIds.includes(b.id)),
          clipboardTracks: s.tracks.filter((t) => s.selectedTrackIds.includes(t.id)),
          clipboardGroupRects: s.groupRects.filter((g) => s.selectedGroupRectIds.includes(g.id)),
        };
      }),

    pasteClipboard: () =>
      set((s) => {
        if (
          s.clipboardBlocks.length === 0 &&
          s.clipboardTracks.length === 0 &&
          s.clipboardGroupRects.length === 0
        ) {
          return s;
        }
        const newBlocks = s.clipboardBlocks.map((b) => ({
          ...b,
          id: generateId(),
          x: b.x + 20,
          y: b.y + 20,
          groupId: undefined,
        }));
        const newTracks = s.clipboardTracks.map((t) => ({
          ...t,
          id: generateId(),
          nodes: t.nodes.map((n) => ({
            ...n,
            id: generateId(),
            x: n.x + 20,
            y: n.y + 20,
          })),
        }));
        const newGroupRects = s.clipboardGroupRects.map((g) => ({
          ...g,
          id: generateId(),
          x: g.x + 20,
          y: g.y + 20,
        }));
        return {
          blocks: [...s.blocks, ...newBlocks],
          selectedBlockIds: newBlocks.map((b) => b.id),
          tracks: [...s.tracks, ...newTracks],
          selectedTrackIds: newTracks.map((t) => t.id),
          groupRects: [...s.groupRects, ...newGroupRects],
          selectedGroupRectIds: newGroupRects.map((g) => g.id),
        };
      }),

    duplicateSelected: () => {
      get().copySelected();
      get().pasteClipboard();
    },

    updateCamera: (cameraUpdates) =>
      set((s) => ({ camera: { ...s.camera, ...cameraUpdates } })),

    setHoveredBlockId: (hoveredBlockId) => set({ hoveredBlockId }),
    setHoveredGroupRectId: (hoveredGroupRectId) => set({ hoveredGroupRectId }),
    setActiveNodeDrag: (activeNodeDrag) => set({ activeNodeDrag }),

    addTrack: (track) => {
      const id = generateId();
      set((s) => ({ tracks: [...s.tracks, { enabled: true, ...track, id }] }));
      return id;
    },

    updateTrack: (id, updates) =>
      set((s) => {
        const newState: Partial<CanvasFeatureHost> = {
          tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        };
        if (
          updates.name !== undefined ||
          updates.bpm !== undefined ||
          updates.loop !== undefined ||
          updates.enabled !== undefined
        ) {
          newState.lastSelectedId = id;
          newState.lastSelectedType = 'track';
        }
        if (updates.enabled === false) {
          const newStatus = { ...s.trackPlaybackStatus };
          delete newStatus[id];
          newState.trackPlaybackStatus = newStatus;
          newState.runners = s.runners.filter((r) => r.trackId !== id);
        }
        return newState;
      }),

    deleteTrack: (id) =>
      set((s) => {
        const newState: Partial<CanvasFeatureHost> = {
          tracks: s.tracks.filter((t) => t.id !== id),
          runners: s.runners.filter((r) => r.trackId !== id),
        };
        if (s.activeTrackId === id) newState.activeTrackId = null;
        return newState;
      }),

    addTrackNode: (trackId, node) => {
      let id = generateId();
      set((s) => ({
        tracks: s.tracks.map((t) => {
          if (t.id !== trackId) return t;
          if (t.nodes.length > 0) {
            const first = t.nodes[0];
            const last = t.nodes[t.nodes.length - 1];
            const distToFirst = Math.hypot(first.x - node.x, first.y - node.y);
            const distToLast = Math.hypot(last.x - node.x, last.y - node.y);
            if (distToFirst < 1) {
              id = first.id;
              return t;
            }
            if (distToLast < 1) {
              id = last.id;
              return t;
            }
            if (distToFirst < distToLast) {
              return { ...t, nodes: [{ ...node, id }, ...t.nodes] };
            }
          }
          return { ...t, nodes: [...t.nodes, { ...node, id }] };
        }),
      }));
      return id;
    },

    insertTrackNode: (trackId, index, node) => {
      const id = generateId();
      set((s) => ({
        tracks: s.tracks.map((t) => {
          if (t.id !== trackId) return t;
          const newNodes = [...t.nodes];
          newNodes.splice(index, 0, { ...node, id });
          return { ...t, nodes: newNodes };
        }),
      }));
      return id;
    },

    removeTrackNode: (trackId, nodeId) =>
      set((s) => {
        let trackBecameEmpty = false;
        const newTracks = s.tracks.map((t) => {
          if (t.id !== trackId) return t;
          const newNodes = t.nodes.filter((n) => n.id !== nodeId);
          if (newNodes.length === 0) trackBecameEmpty = true;
          return { ...t, nodes: newNodes };
        });
        const newState: Partial<CanvasFeatureHost> = {
          tracks: newTracks.filter((t) => t.nodes.length > 0),
        };
        if (trackBecameEmpty && s.activeTrackId === trackId) {
          newState.activeTrackId = null;
        }
        return newState;
      }),

    updateTrackNode: (trackId, nodeId, updates) =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId
            ? { ...t, nodes: t.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)) }
            : t,
        ),
      })),

    setRunners: (runners) => set({ runners }),

    latestPerformHit: null,
    setLatestPerformHit: (hit) => set({ latestPerformHit: hit }),

    mode: 'select' as Mode,
    setMode: (mode: Mode) => set({ mode }),

    openContextMenu: () => {
      // No-op by default, can be overridden by host store
    },
  };
}

/** editor 刪 block 時保留 MIDI 中仍有效的 pitch */
export function editorDeleteBlockFilter(
  blocksToRemove: Block[],
  get: () => CanvasFeatureHost,
  getMidiData: () => { tracks: { instrument: string; notes: { name: string }[] }[] } | null,
): Block[] {
  const midiData = getMidiData();
  if (!midiData) return blocksToRemove;

  const state = get();
  const pitchCounts = new Map<string, number>();
  state.blocks.forEach((b) => {
    const key = `${b.pitch}-${b.instrument || 'piano'}`;
    pitchCounts.set(key, (pitchCounts.get(key) || 0) + 1);
  });

  return blocksToRemove.filter((b) => {
    let isInvalid = true;
    const bInst = b.instrument || 'piano';
    for (const track of midiData.tracks) {
      if (track.instrument === bInst && track.notes.some((n) => n.name === b.pitch)) {
        isInvalid = false;
        break;
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
