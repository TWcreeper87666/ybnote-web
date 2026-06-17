import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isHistoryPausedForContinuous = false;

interface Block {
  id: string;
  name?: string; // Optional custom name
  x: number;
  y: number;
  pitch: string; // e.g., 'C4', 'D#4'
  instrument: string; // e.g., 'piano'
  volume?: number; // 0.0 to 1.0
  keyBinding?: string; // Key to trigger this block
  groupId?: string; // ID of the group this block belongs to
  playedAt?: number; // Timestamp of last play for animation
}

interface Group {
  id: string;
  name: string;
}

export interface GroupRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  playedAt?: number;
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface TrackNode {
  id: string;
  x: number;
  y: number;
}

interface Track {
  id: string;
  nodes: TrackNode[];
  bpm: number;
  loop: boolean;
}

interface Runner {
  id: string;
  trackId: string;
  progress: number;
}

export type Theme = 'light' | 'dark';
export type Mode = 'select' | 'draw_track' | 'piano' | 'drum' | 'draw_group';

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
  isHierarchyOpen: boolean;
  searchQuery: string;
  isSearchOpen: boolean;
  
  // Display Settings
  showBlockName: boolean;
  showBlockPitch: boolean;
  showBlockVolume: boolean;
  showBlockInstrument: boolean;
  
  hoveredBlockId: string | null;
  activeNodeDrag: { trackId: string, nodeId: string } | null;
  
  // Playback & Mode
  isPlaying: boolean;
  mode: Mode;
  editingTrackId: string | null;
  activeTrackId: string | null;
  
  pianoKeysCount: number;
  blockOpacity: number;
  contextMenu: { x: number, y: number, blockId: string } | null;
  
  // Actions
  addBlock: (block: Omit<Block, 'id'>) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlocks: (updates: {id: string, updates: Partial<Block>}[]) => void;
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
  openContextMenu: (menu: { x: number, y: number, blockId: string }) => void;
  closeContextMenu: () => void;
  togglePiano: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  toggleHierarchy: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  setHoveredBlockId: (id: string | null) => void;
  setDisplaySettings: (settings: Partial<{showBlockName: boolean, showBlockPitch: boolean, showBlockVolume: boolean, showBlockInstrument: boolean}>) => void;

  // Track & Playback Actions
  addTrack: (track: Omit<Track, 'id'>) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  togglePlay: () => void;
  stopPlay: () => void;
  setMode: (mode: Mode) => void;
  setEditingTrackId: (id: string | null) => void;
  setActiveTrackId: (id: string | null) => void;
  setActiveNodeDrag: (state: { trackId: string, nodeId: string } | null) => void;
  addTrackNode: (trackId: string, node: Omit<TrackNode, 'id'>) => string;
  insertTrackNode: (trackId: string, index: number, node: Omit<TrackNode, 'id'>) => string;
  removeTrackNode: (trackId: string, nodeId: string) => void;
  updateTrackNode: (trackId: string, nodeId: string, updates: Partial<TrackNode>) => void;
  setRunners: (runners: Runner[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>()(
  temporal(
    persist(
      (set, get) => ({
        blocks: [
          { id: '1', name: 'Note 1', x: 200, y: 200, pitch: 'C4', volume: 1, instrument: 'piano', keyBinding: 'a' },
          { id: '2', name: 'Note 2', x: 300, y: 250, pitch: 'E4', volume: 1, instrument: 'piano', keyBinding: 's' },
          { id: '3', name: 'Note 3', x: 400, y: 200, pitch: 'G4', volume: 1, instrument: 'piano', keyBinding: 'd' }
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
        theme: 'dark',
        showGrid: true,
        snapToGrid: true,
        isPianoOpen: false,
        isSettingsOpen: false,
        isHelpOpen: false,
        isHierarchyOpen: true,
        searchQuery: '',
        isSearchOpen: false,
        
        showBlockName: true,
        showBlockPitch: true,
        showBlockVolume: true,
        showBlockInstrument: true,
        
        hoveredBlockId: null,
        activeNodeDrag: null,

        isPlaying: false,
        mode: 'select',
        editingTrackId: null,
        activeTrackId: null,

        pianoKeysCount: 36,
        blockOpacity: 1,
        contextMenu: null,

        addBlock: (block) => set((state) => ({ 
          blocks: [...state.blocks, { ...block, id: generateId() }] 
        })),
        
        removeBlock: (id) => set((state) => ({ 
          blocks: state.blocks.filter((b) => b.id !== id),
          selectedBlockIds: state.selectedBlockIds.filter((selId) => selId !== id)
        })),

        updateBlock: (id, updates) => set((state) => ({
          blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
        })),

        updateBlocks: (updates) => set((state) => {
          const updateMap = new Map(updates.map(u => [u.id, u.updates]));
          return {
            blocks: state.blocks.map(b => updateMap.has(b.id) ? { ...b, ...updateMap.get(b.id)! } : b)
          };
        }),

        deleteSelected: () => set((state) => ({
          blocks: state.blocks.filter((b) => !state.selectedBlockIds.includes(b.id)),
          selectedBlockIds: [],
          tracks: state.tracks.filter(t => !state.selectedTrackIds.includes(t.id)),
          runners: state.runners.filter(r => !state.selectedTrackIds.includes(r.trackId)),
          selectedTrackIds: [],
          groupRects: state.groupRects.filter(g => !state.selectedGroupRectIds.includes(g.id)),
          selectedGroupRectIds: []
        })),

        selectBlock: (id, multi) => set((state) => {
          const block = state.blocks.find(b => b.id === id);
          const targetIds = block?.groupId ? state.blocks.filter(b => b.groupId === block.groupId).map(b => b.id) : [id];

          if (multi) {
            const isSelected = state.selectedBlockIds.includes(id);
            return {
              selectedBlockIds: isSelected 
                ? state.selectedBlockIds.filter((selId) => !targetIds.includes(selId))
                : [...new Set([...state.selectedBlockIds, ...targetIds])],
              activeTrackId: null,
              editingTrackId: null
            };
          }
          return { selectedBlockIds: targetIds, selectedTrackIds: [], selectedGroupRectIds: [], activeTrackId: null, editingTrackId: null };
        }),

        selectTrack: (id, multi) => set((state) => {
          if (multi) {
            const isSelected = state.selectedTrackIds.includes(id);
            return {
              selectedTrackIds: isSelected
                ? state.selectedTrackIds.filter(tId => tId !== id)
                : [...new Set([...state.selectedTrackIds, id])],
              activeTrackId: id,
            };
          }
          return { selectedTrackIds: [id], selectedBlockIds: [], selectedGroupRectIds: [], activeTrackId: id };
        }),

        selectGroupRect: (id, multi) => set((state) => {
          if (multi) {
            const isSelected = state.selectedGroupRectIds.includes(id);
            return {
              selectedGroupRectIds: isSelected
                ? state.selectedGroupRectIds.filter(gId => gId !== id)
                : [...new Set([...state.selectedGroupRectIds, id])]
            };
          }
          return { selectedGroupRectIds: [id], selectedBlockIds: [], selectedTrackIds: [] };
        }),

        selectAll: () => set((state) => ({
          selectedBlockIds: state.blocks.map(b => b.id),
          selectedTrackIds: state.tracks.map(t => t.id),
          selectedGroupRectIds: state.groupRects.map(g => g.id),
          activeTrackId: null,
          editingTrackId: null
        })),

        selectAllBlocks: () => set((state) => ({
          selectedBlockIds: state.blocks.map(b => b.id),
          selectedTrackIds: [],
          selectedGroupRectIds: [],
          activeTrackId: null,
          editingTrackId: null
        })),

        clearSelection: () => set({ selectedBlockIds: [], selectedTrackIds: [], selectedGroupRectIds: [], activeTrackId: null, editingTrackId: null }),

        mutateBlocks: (targetIds, mutator, options) => {
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
          }).filter(Boolean) as {id: string, updates: Partial<Block>}[];

          if (updates.length === 0) return;

          if (options?.continuous) {
            if (!isHistoryPausedForContinuous) {
              useStore.temporal.setState(s => ({
                pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, tracks: state.tracks }],
                futureStates: []
              }));
              useStore.temporal.getState().pause();
              isHistoryPausedForContinuous = true;
            }
            if (historyDebounceTimer) {
              clearTimeout(historyDebounceTimer as any);
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
          if (state.selectedBlockIds.length < 2) return state;
          const groupId = generateId();
          const newGroup: Group = { id: groupId, name: `Group ${state.groups.length + 1}` };
          return {
            groups: [...state.groups, newGroup],
            blocks: state.blocks.map(b => 
              state.selectedBlockIds.includes(b.id) ? { ...b, groupId } : b
            )
          };
        }),

        ungroupSelected: () => set((state) => {
          // Find groups of selected blocks
          const groupIdsToRemove = new Set(
            state.blocks.filter(b => state.selectedBlockIds.includes(b.id) && b.groupId).map(b => b.groupId)
          );
          if (groupIdsToRemove.size === 0) return state;
          return {
            blocks: state.blocks.map(b => 
              b.groupId && groupIdsToRemove.has(b.groupId) ? { ...b, groupId: undefined } : b
            ),
            groups: state.groups.filter(g => !groupIdsToRemove.has(g.id))
          };
        }),

        updateGroup: (id, name) => set((state) => ({
          groups: state.groups.map(g => g.id === id ? { ...g, name } : g)
        })),

        addGroupRect: (groupRect) => {
          const id = generateId();
          set((state) => ({ groupRects: [...state.groupRects, { ...groupRect, id }] }));
          return id;
        },
        updateGroupRect: (id, updates) => set((state) => ({
          groupRects: state.groupRects.map(g => g.id === id ? { ...g, ...updates } : g)
        })),
        removeGroupRect: (id) => set((state) => ({
          groupRects: state.groupRects.filter(g => g.id !== id)
        })),

        copySelected: () => {
          const state = get();
          const blocksToCopy = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
          const tracksToCopy = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
          const groupRectsToCopy = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
          set({ clipboardBlocks: blocksToCopy, clipboardTracks: tracksToCopy, clipboardGroupRects: groupRectsToCopy });
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
        openContextMenu: (menu) => set({ contextMenu: menu }),
        closeContextMenu: () => set({ contextMenu: null }),
        togglePiano: () => set((state) => ({ isPianoOpen: !state.isPianoOpen, isSettingsOpen: false, isHelpOpen: false })),
        toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isPianoOpen: false, isHelpOpen: false })),
        toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen, isPianoOpen: false, isSettingsOpen: false })),
        toggleHierarchy: () => set((state) => ({ isHierarchyOpen: !state.isHierarchyOpen })),
        setSearchQuery: (searchQuery) => set({ searchQuery }),
        setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
        setHoveredBlockId: (hoveredBlockId) => set({ hoveredBlockId }),
        setDisplaySettings: (settings) => set((state) => ({ ...state, ...settings })),

        addTrack: (track) => {
          const id = generateId();
          set((state) => ({ tracks: [...state.tracks, { ...track, id }] }));
          return id;
        },
        updateTrack: (id, updates) => set((state) => ({
          tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
        })),
        deleteTrack: (id) => set((state) => ({
          tracks: state.tracks.filter(t => t.id !== id),
          runners: state.runners.filter(r => r.trackId !== id)
        })),
        togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
        stopPlay: () => set({ isPlaying: false, runners: [] }),
        setMode: (mode) => set((state) => ({ 
          mode, 
          activeTrackId: mode === 'select' ? null : state.activeTrackId,
          selectedBlockIds: mode === 'draw_track' || mode === 'draw_group' ? [] : state.selectedBlockIds,
          selectedTrackIds: mode === 'draw_track' || mode === 'draw_group' ? [] : state.selectedTrackIds,
          selectedGroupRectIds: mode === 'draw_track' || mode === 'draw_group' ? [] : state.selectedGroupRectIds,
          isPianoOpen: mode === 'piano',
          isSettingsOpen: false,
          isHelpOpen: false
        })),
        setEditingTrackId: (editingTrackId) => set({ editingTrackId }),
        setActiveTrackId: (activeTrackId) => set({ activeTrackId, selectedBlockIds: [], selectedTrackIds: activeTrackId ? [activeTrackId] : [], selectedGroupRectIds: [] }),
        setActiveNodeDrag: (activeNodeDrag) => set({ activeNodeDrag }),
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
          const tracks = state.tracks.map(t => {
            if (t.id === trackId) {
              return { ...t, nodes: t.nodes.filter(n => n.id !== nodeId) };
            }
            return t;
          });
          // Also check if any track has 0 nodes and remove it? Let's leave them or delete if 0
          return { tracks: tracks.filter(t => t.nodes.length > 0) };
        }),
        updateTrackNode: (trackId, nodeId, updates) => set((state) => ({
          tracks: state.tracks.map(t => t.id === trackId ? {
            ...t,
            nodes: t.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
          } : t)
        })),
        setRunners: (runners) => set({ runners }),
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
          showBlockName: state.showBlockName,
          showBlockPitch: state.showBlockPitch,
          showBlockVolume: state.showBlockVolume,
          showBlockInstrument: state.showBlockInstrument,
          camera: state.camera
        }), // only persist these fields
      }
    ),
    {
      partialize: (state) => ({ blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks }), // only track history for blocks, groups, groupRects, tracks
      equality: (pastState, currentState) => {
        if (pastState.groups !== currentState.groups) return false;
        if (pastState.groupRects !== currentState.groupRects) return false;
        if (pastState.tracks !== currentState.tracks) return false;
        if (pastState.blocks === currentState.blocks) return true;
        if (pastState.blocks.length !== currentState.blocks.length) return false;
        for (let i = 0; i < pastState.blocks.length; i++) {
          const pb = pastState.blocks[i];
          const cb = currentState.blocks[i];
          if (pb === cb) continue;
          if (pb.id !== cb.id || pb.x !== cb.x || pb.y !== cb.y || pb.pitch !== cb.pitch || 
              pb.volume !== cb.volume ||
              pb.instrument !== cb.instrument || pb.keyBinding !== cb.keyBinding || 
              pb.groupId !== cb.groupId || pb.name !== cb.name) {
            return false;
          }
        }
        return true;
      },
    }
  )
);
