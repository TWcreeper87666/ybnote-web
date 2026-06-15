import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';

interface Block {
  id: string;
  name?: string; // Optional custom name
  x: number;
  y: number;
  pitch: string; // e.g., 'C4', 'D#4'
  instrument: string; // e.g., 'piano'
  keyBinding?: string; // Key to trigger this block
  groupId?: string; // ID of the group this block belongs to
  playedAt?: number; // Timestamp of last play for animation
}

interface Group {
  id: string;
  name: string;
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export type Theme = 'light' | 'dark';

interface AppState {
  blocks: Block[];
  groups: Group[];
  selectedBlockIds: string[];
  clipboardBlocks: Block[];
  camera: CameraState;
  theme: Theme;
  showGrid: boolean;
  snapToGrid: boolean;
  
  // UI States
  isPianoOpen: boolean;
  isSettingsOpen: boolean;
  isHierarchyOpen: boolean;
  searchQuery: string;
  isSearchOpen: boolean;
  
  pianoKeysCount: number;
  blockOpacity: number;
  contextMenu: { x: number, y: number, blockId: string } | null;
  
  // Actions
  addBlock: (block: Omit<Block, 'id'>) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlocks: (updates: {id: string, updates: Partial<Block>}[]) => void;
  deleteSelectedBlocks: () => void;
  selectBlock: (id: string, multi?: boolean) => void;
  selectAllBlocks: () => void;
  clearSelection: () => void;
  
  // Grouping
  groupSelected: () => void;
  ungroupSelected: () => void;
  updateGroup: (id: string, name: string) => void;

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
  toggleHierarchy: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useStore = create<AppState>()(
  temporal(
    persist(
      (set, get) => ({
        blocks: [
          { id: '1', name: 'Note 1', x: 200, y: 200, pitch: 'C4', instrument: 'piano', keyBinding: 'a' },
          { id: '2', name: 'Note 2', x: 300, y: 250, pitch: 'E4', instrument: 'piano', keyBinding: 's' },
          { id: '3', name: 'Note 3', x: 400, y: 200, pitch: 'G4', instrument: 'piano', keyBinding: 'd' }
        ],
        groups: [],
        selectedBlockIds: [],
        clipboardBlocks: [],
        camera: { x: 0, y: 0, zoom: 1 },
        theme: 'dark',
        showGrid: true,
        snapToGrid: true,
        isPianoOpen: false,
        isSettingsOpen: false,
        isHierarchyOpen: true,
        searchQuery: '',
        isSearchOpen: false,

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

        deleteSelectedBlocks: () => set((state) => ({
          blocks: state.blocks.filter((b) => !state.selectedBlockIds.includes(b.id)),
          selectedBlockIds: []
        })),

        selectBlock: (id, multi) => set((state) => {
          const block = state.blocks.find(b => b.id === id);
          const targetIds = block?.groupId ? state.blocks.filter(b => b.groupId === block.groupId).map(b => b.id) : [id];

          if (multi) {
            const isSelected = state.selectedBlockIds.includes(id);
            return {
              selectedBlockIds: isSelected 
                ? state.selectedBlockIds.filter((selId) => !targetIds.includes(selId))
                : [...new Set([...state.selectedBlockIds, ...targetIds])]
            };
          }
          return { selectedBlockIds: targetIds };
        }),

        selectAllBlocks: () => set((state) => ({
          selectedBlockIds: state.blocks.map(b => b.id)
        })),

        clearSelection: () => set({ selectedBlockIds: [] }),

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

        copySelected: () => {
          const state = get();
          const blocksToCopy = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
          set({ clipboardBlocks: blocksToCopy });
        },

        pasteClipboard: () => set((state) => {
          if (state.clipboardBlocks.length === 0) return state;
          const newBlocks = state.clipboardBlocks.map(b => ({
            ...b,
            id: generateId(),
            x: b.x + 20, // offset slightly
            y: b.y + 20,
            groupId: undefined // drop group when pasting
          }));
          return {
            blocks: [...state.blocks, ...newBlocks],
            selectedBlockIds: newBlocks.map(b => b.id)
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
        togglePiano: () => set((state) => ({ isPianoOpen: !state.isPianoOpen, isSettingsOpen: false })),
        toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isPianoOpen: false })),
        toggleHierarchy: () => set((state) => ({ isHierarchyOpen: !state.isHierarchyOpen })),
        setSearchQuery: (searchQuery) => set({ searchQuery }),
        setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
      }),
      {
        name: 'ybnote-storage',
        partialize: (state) => ({ 
          blocks: state.blocks, 
          groups: state.groups,
          theme: state.theme, 
          showGrid: state.showGrid, 
          snapToGrid: state.snapToGrid,
          pianoKeysCount: state.pianoKeysCount,
          blockOpacity: state.blockOpacity
        }), // only persist these fields
      }
    ),
    {
      partialize: (state) => ({ blocks: state.blocks, groups: state.groups }), // only track history for blocks and groups
      equality: (pastState, currentState) => {
        if (pastState.groups !== currentState.groups) return false;
        if (pastState.blocks === currentState.blocks) return true;
        if (pastState.blocks.length !== currentState.blocks.length) return false;
        for (let i = 0; i < pastState.blocks.length; i++) {
          const pb = pastState.blocks[i];
          const cb = currentState.blocks[i];
          if (pb === cb) continue;
          if (pb.id !== cb.id || pb.x !== cb.x || pb.y !== cb.y || pb.pitch !== cb.pitch || 
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
