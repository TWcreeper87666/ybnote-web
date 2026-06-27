import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { FederatedPointerEvent, Container } from 'pixi.js';
import { lineIntersectsRect } from '../../../utils/geometry';
import { getCanvasState } from '../../../store/canvasAdapter';

interface TrailDeps {
  intersectedBlocksRef: MutableRefObject<Set<string>>;
  startTrail: (x: number, y: number) => void;
  updateTrail: (x: number, y: number, cb: (p1: { x: number; y: number }, p2: { x: number; y: number }) => void) => boolean;
  endTrail: () => void;
}

export function useTrailTool(
  context: 'playground' | 'editor',
  { intersectedBlocksRef, startTrail, updateTrail, endTrail }: TrailDeps
) {
  const checkIntersection = useCallback((
    x1: number, y1: number, x2: number, y2: number,
    isFirstPoint = false, startedOnBlock = false
  ) => {
    const canvas = getCanvasState(context);
    const currentFrameIntersected = new Set<string>();

    canvas.blocks.forEach(b => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
          canvas.updateBlock(b.id, { playedAt: Date.now(), playedVolumeMultiplier: 1 });
        }
      }
    });

    canvas.groupRects.forEach(g => {
      if (g.enabled === false) return;
      if (lineIntersectsRect(x1, y1, x2, y2, g.x, g.y, g.w, g.h)) {
        currentFrameIntersected.add(`groupRect:${g.id}`);
        if (!intersectedBlocksRef.current.has(`groupRect:${g.id}`)) {
          if (!(isFirstPoint && startedOnBlock)) {
            canvas.updateGroupRect(g.id, { playedAt: Date.now() });
            const isInside = (bx: number, by: number, bw: number, bh: number) =>
              bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;
            const blocksInside = canvas.blocks.filter(b => isInside(b.x, b.y, 60, 60));
            if (blocksInside.length > 0) {
              canvas.updateBlocks(blocksInside.map(b => ({
                id: b.id,
                updates: { playedAt: Date.now(), playedVolumeMultiplier: g.volume ?? 1 },
              })));
            }
          }
        }
      }
    });

    intersectedBlocksRef.current = currentFrameIntersected;
  }, [intersectedBlocksRef, context]);

  const isOverTrack = (e: FederatedPointerEvent): boolean => {
    let t = e.target as Container | null;
    while (t) {
      if (t.label === 'track-interactive') return true;
      t = t.parent;
    }
    return false;
  };

  const onPointerDown = (e: FederatedPointerEvent): boolean => {
    if (e.button !== 2) return false;
    if (isOverTrack(e)) return false;
    const canvas = getCanvasState(context);
    canvas.closeContextMenu();
    if ((e.target as Container | null)?.label === 'background') canvas.clearSelection();
    const pos = (e.currentTarget as Container).toLocal(e.global);
    let startedOnBlock = false;
    let current = e.target as Container | null;
    while (current) {
      if (current.label === 'note-block') { startedOnBlock = true; break; }
      current = current.parent;
    }
    intersectedBlocksRef.current.clear();
    startTrail(pos.x, pos.y);
    checkIntersection(pos.x, pos.y, pos.x, pos.y, true, startedOnBlock);
    return true;
  };

  const onPointerMove = (e: FederatedPointerEvent): boolean => {
    if (e.buttons !== 2 || getCanvasState(context).activeNodeDrag) return false;
    if (isOverTrack(e)) {
      endTrail();
      intersectedBlocksRef.current.clear();
      return true;
    }
    const pos = (e.currentTarget as Container).toLocal(e.global);
    updateTrail(pos.x, pos.y, (p1, p2) => checkIntersection(p1.x, p1.y, p2.x, p2.y));
    return true;
  };

  const onPointerUp = (): void => {
    endTrail();
    intersectedBlocksRef.current.clear();
  };

  return { checkIntersection, onPointerDown, onPointerMove, onPointerUp };
}
