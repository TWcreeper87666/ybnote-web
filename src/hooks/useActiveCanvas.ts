import type { CanvasContextType } from '../components/canvas/CanvasContext';
import { useCanvas, getCanvasAdapter } from '../store/canvasAdapter';
import type { Block, GroupRect, Track } from '../types';

// ─── Reactive hooks (call at top level of component/hook) ─────────────────────

export const useActiveCanvasCamera               = () => useCanvas().useCamera();
export const useActiveCanvasGroupRects           = () => useCanvas().useGroupRects();
export const useActiveCanvasTracks               = () => useCanvas().useTracks();
export const useActiveCanvasSelectedBlockIds     = () => useCanvas().useSelectedBlockIds();
export const useActiveCanvasSelectedGroupRectIds = () => useCanvas().useSelectedGroupRectIds();
export const useActiveCanvasSelectedTrackIds     = () => useCanvas().useSelectedTrackIds();

// ─── Non-reactive snapshots (for event handlers) ──────────────────────────────

export const getBlocksForContext               = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getBlocks();
export const getCameraForContext               = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getCamera();
export const getGroupRectsForContext           = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getGroupRects();
export const getTracksForContext               = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getTracks();
export const getSelectedBlockIdsForContext     = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getSelectedBlockIds();
export const getSelectedGroupRectIdsForContext = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getSelectedGroupRectIds();
export const getSelectedTrackIdsForContext     = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getSelectedTrackIds();
export const getLastSelectedForContext         = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getLastSelected();
export const getContextMenuForContext          = (ctx: CanvasContextType) => getCanvasAdapter(ctx).getContextMenu();

// ─── Write helpers ────────────────────────────────────────────────────────────

export const updateBlocksInContext        = (ctx: CanvasContextType, updates: { id: string; updates: Partial<Block> }[]) => getCanvasAdapter(ctx).updateBlocks(updates);
export const updateBlockInContext         = (ctx: CanvasContextType, id: string, updates: Partial<Block>) => getCanvasAdapter(ctx).updateBlock(id, updates);
export const updateGroupRectInContext     = (ctx: CanvasContextType, id: string, updates: Partial<GroupRect>) => getCanvasAdapter(ctx).updateGroupRect(id, updates);
export const updateTrackInContext         = (ctx: CanvasContextType, id: string, updates: Partial<Track>) => getCanvasAdapter(ctx).updateTrack(id, updates);
export const selectBlockInContext         = (ctx: CanvasContextType, id: string, multi?: boolean) => getCanvasAdapter(ctx).selectBlock(id, multi);
export const selectGroupRectInContext     = (ctx: CanvasContextType, id: string, multi?: boolean) => getCanvasAdapter(ctx).selectGroupRect(id, multi);
export const selectTrackInContext         = (ctx: CanvasContextType, id: string, multi?: boolean) => getCanvasAdapter(ctx).selectTrack(id, multi);
export const clearSelectionInContext      = (ctx: CanvasContextType) => getCanvasAdapter(ctx).clearSelection();
export const openContextMenuInContext     = (ctx: CanvasContextType, menu: { x: number; y: number; blockId: string }) => getCanvasAdapter(ctx).openContextMenu(menu);
export const closeContextMenuInContext    = (ctx: CanvasContextType) => getCanvasAdapter(ctx).closeContextMenu();
export const setHoveredBlockIdInContext   = (ctx: CanvasContextType, id: string | null) => getCanvasAdapter(ctx).setHoveredBlockId(id);
export const setHoveredGroupRectIdInContext = (ctx: CanvasContextType, id: string | null) => getCanvasAdapter(ctx).setHoveredGroupRectId(id);

// Batch selection helpers (used by OutlinerPanel)
export const setSelectionBatchInContext = (
  ctx: CanvasContextType,
  updates: { selectedBlockIds: string[]; selectedGroupRectIds: string[]; selectedTrackIds: string[]; lastSelectedId: string; lastSelectedType: 'block' | 'groupRect' | 'track' }
) => getCanvasAdapter(ctx).setState(updates);

export const setGroupSelectionBatchInContext = (
  ctx: CanvasContextType,
  updates: { selectedBlockIds: string[]; selectedGroupRectIds: string[]; selectedTrackIds: string[]; lastSelectedId?: string; lastSelectedType?: 'block' | 'groupRect' | 'track' }
) => getCanvasAdapter(ctx).setState(updates);

// Non-reactive: add blocks to the correct store and return their IDs
export const addBlocksToContext = (ctx: CanvasContextType, blocks: Block[]): string[] => {
  const adapter = getCanvasAdapter(ctx);
  const current = adapter.getBlocks();
  adapter.setBlocks([...current, ...blocks]);
  adapter.commitHistory();
  return blocks.map(b => b.id);
};
