import type { StoreSlice } from './storeTypes';
import type { Block, CameraState } from '../types';
import { generateId } from './utils';
import { isLevelEditor } from '../utils/routeUtils';

export interface PocketSlice {
  pocketBlocks: Block[];
  arrangedPocketBlocks: Block[];
  pocketSortMode: 'pitch' | 'time';
  selectedPocketBlockIds: string[];
  pocketCamera: CameraState;
  interactionContext: 'main' | 'pocket';
  activePocketDrag: { offsetX: number, offsetY: number, blocks: Block[], clickedBlockId: string, initialX?: number, initialY?: number } | null;

  setPocketBlocks: (blocks: Block[]) => void;
  updatePocketBlock: (id: string, updates: Partial<Block>) => void;
  setArrangedPocketBlocks: (blocks: Block[]) => void;
  setPocketSortMode: (mode: 'pitch' | 'time') => void;
  selectPocketBlock: (id: string, multi?: boolean) => void;
  clearPocketSelection: () => void;
  selectAllPocketBlocks: () => void;
  copyPocketSelectedToMain: () => void;
  updatePocketCamera: (camera: Partial<CameraState>) => void;
  setInteractionContext: (context: 'main' | 'pocket') => void;
  setActivePocketDrag: (drag: { offsetX: number, offsetY: number, blocks: Block[], clickedBlockId: string, initialX?: number, initialY?: number } | null) => void;
}

export const createPocketSlice: StoreSlice<PocketSlice> = (set) => ({
  pocketBlocks: [],
  arrangedPocketBlocks: [],
  pocketSortMode: 'pitch',
  selectedPocketBlockIds: [],
  pocketCamera: { x: 0, y: 0, zoom: 1 },
  interactionContext: 'main',
  activePocketDrag: null,

  setPocketBlocks: (blocks) => set({ pocketBlocks: blocks, selectedPocketBlockIds: [] }),
  updatePocketBlock: (id, updates) => set((state) => {
    if (updates.playedAt !== undefined) {
       state.recordEvent('block', id);
    }
    return { pocketBlocks: state.pocketBlocks.map(b => b.id === id ? { ...b, ...updates } : b) };
  }),
  setArrangedPocketBlocks: (blocks) => set({ arrangedPocketBlocks: blocks }),
  setPocketSortMode: (mode) => set({ pocketSortMode: mode }),
  updatePocketCamera: (cameraUpdates) => set((state) => ({ pocketCamera: { ...state.pocketCamera, ...cameraUpdates } })),
  setInteractionContext: (context) => set({ interactionContext: context }),
  setActivePocketDrag: (drag) => set({ activePocketDrag: drag }),
  selectPocketBlock: (id, multi) => set((state) => {
    const updates: Partial<PocketSlice> = { interactionContext: 'pocket' };
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

    if (isLevelEditor()) {
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
});
