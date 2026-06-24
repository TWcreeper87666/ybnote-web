export { useStore, undoAction, redoAction } from './useStore';
export type { AppState, StoreSlice, StoreSet, StoreGet } from './storeTypes';

export type { UISlice } from './uiSlice';
export { createUISlice } from './uiSlice';

export type { CanvasSlice } from './canvasSlice';
export { createCanvasSlice } from './canvasSlice';

export type { PocketSlice } from './pocketSlice';
export { createPocketSlice } from './pocketSlice';

export type { PlaybackSlice } from './playbackSlice';
export { createPlaybackSlice } from './playbackSlice';

export type { GameSlice } from './gameSlice';
export { createGameSlice } from './gameSlice';

export { generateId, updateCanvas } from './utils';
export type { CanvasState } from './utils';

// --- 新架構 ---
export type { CanvasFeature, CanvasStore, CanvasPersistSlice } from './shared/canvasTypes';
export { canvasPersistKeys } from './shared/canvasTypes';
export { createCanvasFeature, editorDeleteBlockFilter } from './shared/createCanvasFeature';
export type { CanvasFeatureHost, CreateCanvasFeatureOptions } from './shared/createCanvasFeature';
export { generateId as sharedGenerateId } from './shared/generateId';

export { usePlaygroundStore, playgroundCanvasStore } from './usePlaygroundStore';
export type { PlaygroundStoreState } from './usePlaygroundStore';

export { useGameStore } from './useGameStore';
export type { GameStoreState } from './useGameStore';

export { useSettingsStore } from './useSettingsStore';
export { useToastStore } from './useToastStore';

export { CanvasStoreProvider } from './CanvasStoreProvider';
export { useCanvasStore } from './useCanvasStore';

export { useLevelEditorStore } from './useLevelEditorStore';

// Bidirectional sync: keep useStore.gameBlocks/gameEvents/gameCamera in sync with useGameStore.
// This allows legacy level-editor code to keep reading useStore.gameBlocks while
// GamePage/GameCanvas use the new useGameStore.
import { useStore } from './useStore';
import { useGameStore } from './useGameStore';

let _syncing = false;

{
  let _prevGsBlocks = useGameStore.getState().blocks;
  let _prevUsBlocks = useStore.getState().gameBlocks;
  let _prevGsEvents = useGameStore.getState().events;
  let _prevUsEvents = useStore.getState().gameEvents;
  let _prevGsCamera = useGameStore.getState().gameCamera;
  let _prevUsCamera = useStore.getState().gameCamera;

  useGameStore.subscribe((s) => {
    if (_syncing) return;
    if (s.blocks !== _prevGsBlocks) {
      _prevGsBlocks = s.blocks; _syncing = true;
      useStore.getState().setGameBlocks(s.blocks); _prevUsBlocks = s.blocks;
      _syncing = false;
    }
    if (s.events !== _prevGsEvents) {
      _prevGsEvents = s.events; _syncing = true;
      useStore.getState().setGameEvents(s.events); _prevUsEvents = s.events;
      _syncing = false;
    }
    if (s.gameCamera !== _prevGsCamera) {
      _prevGsCamera = s.gameCamera; _syncing = true;
      useStore.getState().updateGameCamera(s.gameCamera); _prevUsCamera = s.gameCamera;
      _syncing = false;
    }
  });

  useStore.subscribe((s) => {
    if (_syncing) return;
    const gs = useGameStore.getState();
    if (s.gameBlocks !== _prevUsBlocks) {
      _prevUsBlocks = s.gameBlocks; _syncing = true;
      gs.setBlocks(s.gameBlocks); _prevGsBlocks = s.gameBlocks;
      _syncing = false;
    }
    if (s.gameEvents !== _prevUsEvents) {
      _prevUsEvents = s.gameEvents; _syncing = true;
      gs.setEvents(s.gameEvents); _prevGsEvents = s.gameEvents;
      _syncing = false;
    }
    if (s.gameCamera !== _prevUsCamera) {
      _prevUsCamera = s.gameCamera; _syncing = true;
      gs.updateGameCamera(s.gameCamera); _prevGsCamera = s.gameCamera;
      _syncing = false;
    }
  });
}
