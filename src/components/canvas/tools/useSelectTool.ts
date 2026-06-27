import type { MutableRefObject } from 'react';
import type { FederatedPointerEvent, Container } from 'pixi.js';
import { trySetPointerCapture } from '../../../utils/canvasUtils';
import { getCanvasAdapter, getCanvasState } from '../../../store/canvasAdapter';

interface SelectDeps {
  isSelectingRef: MutableRefObject<boolean>;
  startSelection: (x: number, y: number) => void;
  updateSelection: (x: number, y: number) => { x: number; y: number; w: number; h: number } | null;
  endSelection: () => void;
}

export function useSelectTool(context: 'playground' | 'editor', { isSelectingRef, startSelection, updateSelection, endSelection }: SelectDeps) {
  const onPointerDown = (e: FederatedPointerEvent): boolean => {
    if ((e.target as Container | null)?.label !== 'background') return false;
    const canvas = getCanvasState(context);
    canvas.closeContextMenu();
    if (!e.ctrlKey && !e.shiftKey) canvas.clearSelection();
    const pos = (e.currentTarget as Container).toLocal(e.global);
    startSelection(pos.x, pos.y);
    trySetPointerCapture(e.target, e.pointerId);
    return true;
  };

  const onPointerMove = (e: FederatedPointerEvent): boolean => {
    if (!isSelectingRef.current) return false;
    const pos = (e.currentTarget as Container).toLocal(e.global);
    const box = updateSelection(pos.x, pos.y);
    if (!box) return true;
    const { x, y, w, h } = box;

    const canvas = getCanvasState(context);
    const { blocks: blocksList, tracks, groupRects } = canvas;

    const directlySelectedBlocks = blocksList.filter(b => b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y);
    const directlySelectedTracks = tracks.filter(t => t.nodes.some(n => n.x >= x && n.x <= x + w && n.y >= y && n.y <= y + h));
    const directlySelectedGroupRects = groupRects.filter(g => g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y);

    const activeGroupIds = new Set([
      ...directlySelectedBlocks.filter(b => b.groupId).map(b => b.groupId as string),
      ...directlySelectedTracks.filter(t => t.groupId).map(t => t.groupId as string),
      ...directlySelectedGroupRects.filter(g => g.groupId).map(g => g.groupId as string),
    ]);

    getCanvasAdapter(context).setState({
      selectedBlockIds: blocksList.filter(b => directlySelectedBlocks.includes(b) || (b.groupId && activeGroupIds.has(b.groupId))).map(b => b.id),
      selectedTrackIds: tracks.filter(t => directlySelectedTracks.includes(t) || (t.groupId && activeGroupIds.has(t.groupId))).map(t => t.id),
      selectedGroupRectIds: groupRects.filter(g => directlySelectedGroupRects.includes(g) || (g.groupId && activeGroupIds.has(g.groupId))).map(g => g.id),
    });
    return true;
  };

  const onPointerUp = (): void => {
    endSelection();
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
