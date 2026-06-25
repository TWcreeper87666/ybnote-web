import { useCanvasContext, type CanvasContextType } from '../components/canvas/CanvasContext';
import { useStore } from '../store/useStore';
import { useGameStore } from '../store/useGameStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import type { Block } from '../types';

// Reactive: returns blocks for the current canvas context
export const useActiveCanvasBlocks = () => {
  const context = useCanvasContext();
  const playgroundBlocks = useStore(s => s.blocks);
  const gameBlocks = useGameStore(s => s.gameBlocks);
  const editorBlocks = useLevelEditorStore(s => s.gameBlocks);

  if (context === 'game') return gameBlocks;
  if (context === 'editor') return editorBlocks;
  return playgroundBlocks;
};

// Reactive: returns the camera for the current canvas context
export const useActiveCanvasCamera = () => {
  const context = useCanvasContext();
  const mainCamera = useStore(s => s.camera);
  const gameCamera = useGameStore(s => s.gameCamera);

  if (context === 'game') return gameCamera;
  return mainCamera; // 'playground' and 'editor' both use the main camera
};

// Non-reactive snapshot: get blocks for a given context (for use inside event handlers)
export const getBlocksForContext = (context: CanvasContextType): Block[] => {
  if (context === 'game') return useGameStore.getState().gameBlocks;
  if (context === 'editor') return useLevelEditorStore.getState().gameBlocks;
  return useStore.getState().blocks;
};

// Non-reactive snapshot: get camera for a given context
export const getCameraForContext = (context: CanvasContextType) => {
  if (context === 'game') return useGameStore.getState().gameCamera;
  return useStore.getState().camera;
};

// Non-reactive: add blocks to the correct store and return their IDs
export const addBlocksToContext = (context: CanvasContextType, blocks: Block[]): string[] => {
  if (context === 'game') {
    const current = useGameStore.getState().gameBlocks;
    useGameStore.getState().setGameBlocks([...current, ...blocks]);
    return blocks.map(b => b.id);
  }
  if (context === 'editor') {
    const current = useLevelEditorStore.getState().gameBlocks;
    useLevelEditorStore.getState().setGameBlocks([...current, ...blocks]);
    useLevelEditorStore.getState().commitHistory();
    return blocks.map(b => b.id);
  }
  return useStore.getState().addBlocks(blocks);
};

// Non-reactive: update blocks in the correct store
export const updateBlocksInContext = (
  context: CanvasContextType,
  updates: { id: string; updates: Partial<Block> }[]
) => {
  if (context === 'game') {
    useGameStore.getState().updateGameBlocks(updates);
  } else if (context === 'editor') {
    useLevelEditorStore.getState().updateGameBlocks(updates);
  } else {
    useStore.getState().updateBlocks(updates);
  }
};

// Non-reactive: commit undo history for contexts that maintain their own history
export const commitContextHistory = (context: CanvasContextType) => {
  if (context === 'editor') {
    useLevelEditorStore.getState().commitHistory();
  }
  // 'playground' uses temporal (Zundo) — caller manages pause/resume
  // 'game' has no undo history
};
