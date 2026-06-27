import { useCallback } from 'react';
import { useIsMobile } from './useIsMobile';
import { useCanvasContext } from '../components/canvas/CanvasContext';
import type { CanvasContextType } from '../components/canvas/CanvasContext';
import { getCanvasAdapter } from '../store/canvasAdapter';
import { createDragHistoryGuard } from '../utils/dragUtils';
import {
  getBlocksForContext, getSelectedBlockIdsForContext,
  getSelectedTrackIdsForContext, getSelectedGroupRectIdsForContext,
  getTracksForContext, getGroupRectsForContext,
  clearSelectionInContext, updateTrackInContext, updateGroupRectInContext,
} from './useActiveCanvas';

export const useBlockDragHandlers = (id: string, canvasContextOverride?: CanvasContextType) => {
  const isMobile = useIsMobile();
  const canvasContextFromHook = useCanvasContext();
  const canvasContext = canvasContextOverride ?? canvasContextFromHook;

  const onDragStart = useCallback(() => {
    const adapter = getCanvasAdapter(canvasContext);
    const selectedIds = getSelectedBlockIdsForContext(canvasContext);
    const sourceBlocks = getBlocksForContext(canvasContext).filter(b => selectedIds.includes(b.id));
    if (!sourceBlocks.find(b => b.id === id)) {
      const thisBlock = getBlocksForContext(canvasContext).find(b => b.id === id);
      if (thisBlock) sourceBlocks.push(thisBlock);
    }

    const selectedTracks = getTracksForContext(canvasContext).filter(
      t => getSelectedTrackIdsForContext(canvasContext).includes(t.id)
    );
    const selectedGroupRects = getGroupRectsForContext(canvasContext).filter(
      g => getSelectedGroupRectIdsForContext(canvasContext).includes(g.id)
    );

    const initialPositions = new Map(sourceBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({ ...n }))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));
    const historyGuard = createDragHistoryGuard(adapter);

    return {
      onMove: (deltaX: number, deltaY: number) => {
        historyGuard.onMove();
        adapter.updateBlocks(sourceBlocks.map(b => {
          const init = initialPositions.get(b.id)!;
          return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
        }));
        selectedTracks.forEach(t => {
          const initNodes = initialTrackNodes.get(t.id)!;
          updateTrackInContext(canvasContext, t.id, { nodes: initNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY })) });
        });
        selectedGroupRects.forEach(g => {
          const init = initialGroupRects.get(g.id)!;
          updateGroupRectInContext(canvasContext, g.id, { x: init.x + deltaX, y: init.y + deltaY });
        });
      },
      onUp: () => {
        historyGuard.onUp();
        if (isMobile) clearSelectionInContext(canvasContext);
      },
    };
  }, [id, canvasContext, isMobile]);

  return { onDragStart };
};
