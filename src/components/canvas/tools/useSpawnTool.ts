import { useRef } from 'react';
import type { FederatedPointerEvent, Container } from 'pixi.js';
import { useStore } from '../../../store/useStore';
import { getCanvasState } from '../../../store/canvasAdapter';

export function useSpawnTool(context: 'playground' | 'editor') {
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{ x: number; y: number } | null>(null);

  // Returns true if a spawn happened (double-click), false to pass through to select tool.
  // Always updates click tracking regardless.
  const onPointerDown = (e: FederatedPointerEvent): boolean => {
    if ((e.target as Container | null)?.label !== 'background') return false;

    const now = Date.now();
    const posLocal = (e.currentTarget as Container).toLocal(e.global);
    const timeDiff = now - lastClickTimeRef.current;

    if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
      if (Math.hypot(posLocal.x - lastClickPosRef.current.x, posLocal.y - lastClickPosRef.current.y) < 20) {
        const canvas = getCanvasState(context);
        const shared = useStore.getState();

        let spawnType: 'block' | 'drum' | 'groupRect' | 'track';
        if (shared.mode === 'drum') {
          spawnType = 'drum';
        } else if (shared.mode === 'piano') {
          spawnType = 'block';
        } else if (canvas.lastSelectedType === 'groupRect') {
          spawnType = 'groupRect';
        } else if (canvas.lastSelectedType === 'track') {
          spawnType = 'track';
        } else if (canvas.lastSelectedType === 'block') {
          const b = canvas.blocks.find(b => b.id === canvas.lastSelectedId);
          spawnType = b?.instrument === 'percussion' ? 'drum' : 'block';
        } else {
          spawnType = 'block';
        }

        if (spawnType === 'groupRect') {
          const g = canvas.groupRects.find(gr => gr.id === canvas.lastSelectedId);
          const w = g?.w || 200;
          const h = g?.h || 200;
          let name = g?.name;
          if (name?.startsWith('Group ')) name = undefined;
          const id = canvas.addGroupRect({ x: posLocal.x - w / 2, y: posLocal.y - h / 2, w, h, name, volume: g?.volume, keyBinding: g?.keyBinding });
          canvas.selectGroupRect(id, false);
        } else if (spawnType === 'track') {
          const t = canvas.tracks.find(t => t.id === canvas.lastSelectedId);
          if (t && t.nodes.length > 0) {
            const dx = posLocal.x - t.nodes[0].x;
            const dy = posLocal.y - t.nodes[0].y;
            const newNodes = t.nodes.map(n => ({ ...n, x: n.x + dx, y: n.y + dy, id: Math.random().toString(36).substring(2, 9) }));
            let name = t.name;
            if (name?.startsWith('Track ')) name = undefined;
            const trackId = canvas.addTrack({ bpm: t.bpm, loop: t.loop, name, nodes: newNodes });
            canvas.selectTrack(trackId, false);
          } else {
            let name = t?.name;
            if (name?.startsWith('Track ')) name = undefined;
            const trackId = canvas.addTrack({ bpm: t?.bpm || 120, loop: t?.loop || false, name, nodes: [] });
            canvas.addTrackNode(trackId, { x: posLocal.x, y: posLocal.y });
            canvas.selectTrack(trackId, false);
          }
        } else {
          const b = canvas.blocks.find(b => b.id === canvas.lastSelectedId);
          canvas.addBlock(spawnType === 'drum'
            ? { pitch: b?.instrument === 'percussion' ? b.pitch : 'kick', instrument: 'percussion', volume: b?.instrument === 'percussion' ? b.volume : 1, keyBinding: b?.instrument === 'percussion' ? b.keyBinding : undefined, x: posLocal.x - 30, y: posLocal.y - 30 }
            : { pitch: b?.instrument !== 'percussion' && b ? b.pitch : 'C4', instrument: b?.instrument !== 'percussion' && b ? b.instrument : 'piano', volume: b?.instrument !== 'percussion' && b ? b.volume : 1, keyBinding: b?.instrument !== 'percussion' && b ? b.keyBinding : undefined, x: posLocal.x - 30, y: posLocal.y - 30 }
          );
        }

        lastClickTimeRef.current = 0;
        return true;
      }
    }

    lastClickTimeRef.current = now;
    lastClickPosRef.current = { x: posLocal.x, y: posLocal.y };
    return false;
  };

  return { onPointerDown };
}
