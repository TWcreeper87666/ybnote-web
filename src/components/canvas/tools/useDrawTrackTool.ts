import type { FederatedPointerEvent, Container } from 'pixi.js';
import { useStore } from '../../../store/useStore';
import { trySetPointerCapture } from '../../../utils/canvasUtils';
import { getCanvasState } from '../../../store/canvasAdapter';

export function useDrawTrackTool(context: 'playground' | 'editor') {
  const onPointerDown = (e: FederatedPointerEvent): boolean => {
    if ((e.target as Container | null)?.label !== 'background') return false;
    const canvas = getCanvasState(context);
    const shared = useStore.getState();
    const pos = (e.currentTarget as Container).toLocal(e.global);
    let trackId = shared.activeTrackId;
    if (!trackId) {
      trackId = canvas.addTrack({ nodes: [], bpm: 120, loop: false });
      shared.setActiveTrackId(trackId);
    }
    const nodeId = canvas.addTrackNode(trackId, { x: pos.x, y: pos.y });
    canvas.setActiveNodeDrag({ trackId, nodeId, isNewNode: true });
    trySetPointerCapture(e.target, e.pointerId);
    return true;
  };

  return { onPointerDown };
}
