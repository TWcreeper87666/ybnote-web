import { create } from 'zustand';
import { createCanvasFeature, type CanvasFeatureHost } from './shared/createCanvasFeature';
import type { CanvasFeature } from './shared/canvasTypes';
import { useToastStore } from './useToastStore';

/**
 * Separate canvas store for LevelEditor blocks tab
 * Manages blocks, tracks, groupRects separately from MIDI editing
 */
export type LevelEditorCanvasStoreState = CanvasFeature &
  Pick<CanvasFeatureHost, 'recordEvent' | 'showToast'>;

export const useLevelEditorCanvasStore = create<LevelEditorCanvasStoreState>((set, get) => {
  const canvas = createCanvasFeature(set as never, get as never, {
    initialBlocks: [],
    // editor canvas deletions don't need MIDI validation
    // (unlike playground which syncs to game state)
  });

  return {
    ...canvas,
    showToast: (msg) => useToastStore.getState().showToast(msg),
    recordEvent: () => {
      // editor canvas doesn't record playback events
    },
  };
});
