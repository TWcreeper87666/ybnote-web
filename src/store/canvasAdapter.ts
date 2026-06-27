import { createContext, useContext } from 'react';
import { useStore } from './useStore';
import { useGameStore } from './useGameStore';
import { useLevelEditorStore } from './useLevelEditorStore';
import type { GameState } from './useGameStore';
import type { LevelEditorState } from './useLevelEditorStore';
import type { CanvasContextType } from '../components/canvas/CanvasContext';
import type { CanvasSliceState, CanvasSliceActions, CanvasSliceAPI } from './createCanvasSlice';
import type { Block, GroupRect, Track, CameraState } from '../types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface CanvasStoreAdapter {
  // Reactive hooks (call unconditionally at top of component/hook)
  useBlocks(): Block[];
  useCamera(): CameraState;
  useGroupRects(): GroupRect[];
  useTracks(): Track[];
  useSelectedBlockIds(): string[];
  useSelectedGroupRectIds(): string[];
  useSelectedTrackIds(): string[];

  // Non-reactive snapshots (for event handlers / effects)
  getBlocks(): Block[];
  getCamera(): CameraState;
  getGroupRects(): GroupRect[];
  getTracks(): Track[];
  getSelectedBlockIds(): string[];
  getSelectedGroupRectIds(): string[];
  getSelectedTrackIds(): string[];
  getLastSelected(): { lastSelectedId: string | null; lastSelectedType: string | null };
  getContextMenu(): { x: number; y: number; blockId: string } | null;

  // Actions
  updateBlocks(updates: { id: string; updates: Partial<Block> }[]): void;
  updateBlock(id: string, updates: Partial<Block>): void;
  setBlocks(blocks: Block[]): void;
  updateGroupRect(id: string, updates: Partial<GroupRect>): void;
  updateTrack(id: string, updates: Partial<Track>): void;
  selectBlock(id: string, multi?: boolean): void;
  selectGroupRect(id: string, multi?: boolean): void;
  selectTrack(id: string, multi?: boolean): void;
  clearSelection(): void;
  openContextMenu(menu: { x: number; y: number; blockId: string }): void;
  closeContextMenu(): void;
  setHoveredBlockId(id: string | null): void;
  setHoveredGroupRectId(id: string | null): void;
  updateCamera(updates: Partial<CameraState>): void;
  setState(updates: Partial<CanvasSliceState>): void;

  // History (store-specific behavior, unified interface)
  pushUndoSnapshot(): void;
  pauseHistory(): void;
  resumeHistory(): void;
  commitHistory(): void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

type CanvasUseStoreFn = <T>(selector: (s: CanvasSliceState & CanvasSliceActions) => T) => T;
type CanvasGetStateFn = () => CanvasSliceState & CanvasSliceActions;

interface AdapterConfig {
  useStoreFn: CanvasUseStoreFn;
  getStateFn: CanvasGetStateFn;
  setStateFn: (updates: Partial<CanvasSliceState>) => void;
  pushUndoSnapshot?: () => void;
  pauseHistory?: () => void;
  resumeHistory?: () => void;
  commitHistory?: () => void;
}

const createCanvasAdapter = ({
  useStoreFn,
  getStateFn,
  setStateFn,
  pushUndoSnapshot = () => {},
  pauseHistory = () => {},
  resumeHistory = () => {},
  commitHistory = () => {},
}: AdapterConfig): CanvasStoreAdapter => ({
  useBlocks:               () => useStoreFn(s => s.blocks),
  useCamera:               () => useStoreFn(s => s.camera),
  useGroupRects:           () => useStoreFn(s => s.groupRects),
  useTracks:               () => useStoreFn(s => s.tracks),
  useSelectedBlockIds:     () => useStoreFn(s => s.selectedBlockIds),
  useSelectedGroupRectIds: () => useStoreFn(s => s.selectedGroupRectIds),
  useSelectedTrackIds:     () => useStoreFn(s => s.selectedTrackIds),

  getBlocks:               () => getStateFn().blocks,
  getCamera:               () => getStateFn().camera,
  getGroupRects:           () => getStateFn().groupRects,
  getTracks:               () => getStateFn().tracks,
  getSelectedBlockIds:     () => getStateFn().selectedBlockIds,
  getSelectedGroupRectIds: () => getStateFn().selectedGroupRectIds,
  getSelectedTrackIds:     () => getStateFn().selectedTrackIds,
  getLastSelected:         () => ({ lastSelectedId: getStateFn().lastSelectedId, lastSelectedType: getStateFn().lastSelectedType }),
  getContextMenu:          () => getStateFn().contextMenu,

  updateBlocks:          (u) => getStateFn().updateBlocks(u),
  updateBlock:           (id, u) => getStateFn().updateBlock(id, u),
  setBlocks:             (b) => getStateFn().setBlocks(b),
  updateGroupRect:       (id, u) => getStateFn().updateGroupRect(id, u),
  updateTrack:           (id, u) => getStateFn().updateTrack(id, u),
  selectBlock:           (id, m) => getStateFn().selectBlock(id, m),
  selectGroupRect:       (id, m) => getStateFn().selectGroupRect(id, m),
  selectTrack:           (id, m) => getStateFn().selectTrack(id, m),
  clearSelection:        () => getStateFn().clearSelection(),
  openContextMenu:       (m) => getStateFn().openContextMenu(m),
  closeContextMenu:      () => getStateFn().closeContextMenu(),
  setHoveredBlockId:     (id) => getStateFn().setHoveredBlockId(id),
  setHoveredGroupRectId: (id) => getStateFn().setHoveredGroupRectId(id),
  updateCamera:          (u) => getStateFn().updateCamera(u),
  setState:              (u) => setStateFn(u),

  pushUndoSnapshot,
  pauseHistory,
  resumeHistory,
  commitHistory,
});

// Safe cast: all three stores extend CanvasSliceState & CanvasSliceActions
const asCanvas = <S extends CanvasSliceState & CanvasSliceActions>(
  hook: (sel: (s: S) => unknown) => unknown
) => hook as unknown as CanvasUseStoreFn;

// ─── Three adapters ───────────────────────────────────────────────────────────

export const gameCanvasAdapter = createCanvasAdapter({
  useStoreFn: asCanvas(useGameStore),
  getStateFn: () => useGameStore.getState(),
  setStateFn: (u) => useGameStore.setState(u as Partial<GameState>),
  pushUndoSnapshot: () => useGameStore.getState().pushUndoSnapshot(),
  commitHistory:    () => useGameStore.getState().commitHistory(),
});

export const editorCanvasAdapter = createCanvasAdapter({
  useStoreFn: asCanvas(useLevelEditorStore),
  getStateFn: () => useLevelEditorStore.getState(),
  setStateFn: (u) => useLevelEditorStore.setState(u as Partial<LevelEditorState>),
  commitHistory: () => useLevelEditorStore.getState().commitHistory(),
});

export const playgroundCanvasAdapter = createCanvasAdapter({
  useStoreFn: asCanvas(useStore),
  getStateFn: () => useStore.getState() as unknown as CanvasSliceState & CanvasSliceActions,
  setStateFn: (u) => useStore.setState(u as Parameters<typeof useStore.setState>[0]),
  pushUndoSnapshot: () => {
    const s = useStore.getState();
    useStore.temporal.setState(prev => ({
      pastStates: [...prev.pastStates, { blocks: s.blocks, groups: s.groups, groupRects: s.groupRects, tracks: s.tracks }],
      futureStates: [],
    }));
  },
  pauseHistory:  () => useStore.temporal.getState().pause(),
  resumeHistory: () => useStore.temporal.getState().resume(),
});

// ─── Provider + hooks ─────────────────────────────────────────────────────────

export const CanvasAdapterCtx = createContext<CanvasStoreAdapter>(null!);

export const useCanvas = (): CanvasStoreAdapter => useContext(CanvasAdapterCtx);

export const getCanvasAdapter = (context: CanvasContextType): CanvasStoreAdapter =>
  context === 'game'   ? gameCanvasAdapter :
  context === 'editor' ? editorCanvasAdapter :
                         playgroundCanvasAdapter;

export const getCanvasState = (context: 'playground' | 'editor'): CanvasSliceAPI =>
  (context === 'editor' ? useLevelEditorStore : useStore).getState() as unknown as CanvasSliceAPI;
