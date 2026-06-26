import React, { useState } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { useGameStore } from '../../store/useGameStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useCanvasContext } from '../canvas/CanvasContext';
import { useCanvas } from '../../store/canvasAdapter';
import { useActiveCanvasTracks, useActiveCanvasSelectedTrackIds } from '../../hooks/useActiveCanvas';
import type { CanvasSliceState, CanvasSliceActions } from '../../store/createCanvasSlice';
import { computeTrackControlPoints } from '../../utils/spline';
import { getCanvasContainerRect, snapValue } from '../../utils/canvasUtils';
import { createDragHistoryGuard } from '../../utils/dragUtils';
import { BaseTrack } from './BaseTrack';
import type { TrackNode } from '../../types';

export const TrackRenderer: React.FC<{ onNodeDeletedByDrag?: () => void }> = ({ onNodeDeletedByDrag }) => {
  const canvasContext = useCanvasContext();
  const adapter = useCanvas();

  const tracks = useActiveCanvasTracks();
  const selectedTrackIds = useActiveCanvasSelectedTrackIds();

  // mode and activeTrackId live in useStore (shared across contexts)
  const mode = useStore(s => s.mode);
  const activeTrackId = useStore(s => s.activeTrackId);

  // activeNodeDrag and runners from the correct context store
  const playgroundNodeDrag = useStore(s => s.activeNodeDrag);
  const editorNodeDrag = useLevelEditorStore(s => s.activeNodeDrag);
  const gameNodeDrag = useGameStore(s => s.activeNodeDrag);
  const activeNodeDrag = canvasContext === 'editor' ? editorNodeDrag
    : canvasContext === 'game' ? gameNodeDrag
    : playgroundNodeDrag;

  const playgroundRunners = useStore(s => s.runners);
  const editorRunners = useLevelEditorStore(s => s.runners);
  const gameRunners = useGameStore(s => s.runners);
  const runners = canvasContext === 'editor' ? editorRunners
    : canvasContext === 'game' ? gameRunners
    : playgroundRunners;

  const getCtxSt = (): CanvasSliceState & CanvasSliceActions => {
    if (canvasContext === 'editor') return useLevelEditorStore.getState();
    if (canvasContext === 'game') return useGameStore.getState();
    return useStore.getState() as unknown as CanvasSliceState & CanvasSliceActions;
  };

  const [isTrackDragging, setIsTrackDragging] = useState<{ trackId: string, dragOffset: { x: number, y: number } } | null>(null);
  const lastClickMapRef = React.useRef<Record<string, number>>({});

  // Unified Track Dragging
  React.useEffect(() => {
    if (!isTrackDragging) return;

    const ctxSt = getCtxSt();
    const selectedBlocks = ctxSt.blocks.filter(b => ctxSt.selectedBlockIds.includes(b.id));
    const selectedTracks = ctxSt.tracks.filter(t => ctxSt.selectedTrackIds.includes(t.id));
    if (!selectedTracks.find(t => t.id === isTrackDragging.trackId)) {
      const thisTrack = ctxSt.tracks.find(t => t.id === isTrackDragging.trackId);
      if (thisTrack) selectedTracks.push(thisTrack);
    }
    const selectedGroupRects = ctxSt.groupRects.filter(g => ctxSt.selectedGroupRectIds.includes(g.id));

    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({...n}))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const historyGuard = createDragHistoryGuard(adapter);

    const handleGlobalMove = (e: PointerEvent) => {
      const st = getCtxSt();
      const camera = st.camera;
      const canvasRect = getCanvasContainerRect(canvasContext);

      const localX = (e.clientX - canvasRect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - canvasRect.top - camera.y) / camera.zoom;

      let newX = localX - isTrackDragging.dragOffset.x;
      let newY = localY - isTrackDragging.dragOffset.y;

      if (useSettingsStore.getState().snapToGrid) {
        newX = snapValue(newX);
        newY = snapValue(newY);
      }

      const initNodes = initialTrackNodes.get(isTrackDragging.trackId);
      if (!initNodes || initNodes.length === 0) return;

      const deltaX = newX - initNodes[0].x;
      const deltaY = newY - initNodes[0].y;

      const currentTrack = st.tracks.find(t => t.id === isTrackDragging.trackId);
      if (currentTrack && currentTrack.nodes.length > 0 &&
          (initNodes[0].x + deltaX) === currentTrack.nodes[0].x &&
          (initNodes[0].y + deltaY) === currentTrack.nodes[0].y) {
        return;
      }

      historyGuard.onMove();

      const finalUpdates = selectedBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
      });

      const trackUpdates = selectedTracks.map(t => {
        const trackInitNodes = initialTrackNodes.get(t.id)!;
        const newNodes = trackInitNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY }));
        return { id: t.id, nodes: newNodes };
      });

      st.updateBlocks(finalUpdates);
      trackUpdates.forEach(tu => {
        st.updateTrack(tu.id, { nodes: tu.nodes });
      });
      selectedGroupRects.forEach(g => {
        const init = initialGroupRects.get(g.id)!;
        st.updateGroupRect(g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsTrackDragging(null);
      historyGuard.onUp();
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [isTrackDragging, adapter, canvasContext]);

  // Node Dragging
  React.useEffect(() => {
    if (!activeNodeDrag) return;

    let hasPaused = false;

    if (activeNodeDrag.isNewNode) {
      // For playground: absorb the addTrackNode history entry so click+drag is one undo action
      if (canvasContext === 'playground') {
        const temporal = (useStore as any).temporal.getState();
        if (temporal.pastStates.length > 0) {
          const preCreationSnapshot = temporal.pastStates[temporal.pastStates.length - 1];
          (useStore as any).temporal.setState((s: any) => ({
            pastStates: s.pastStates.slice(0, -1),
            futureStates: []
          }));
          (useStore as any).temporal.setState((s: any) => ({
            pastStates: [...s.pastStates, preCreationSnapshot],
            futureStates: []
          }));
          (useStore as any).temporal.getState().pause();
          hasPaused = true;
        }
      }
    }

    const handleGlobalMove = (e: PointerEvent) => {
      const st = getCtxSt();
      const camera = st.camera;
      const canvasRect = getCanvasContainerRect(canvasContext);
      let x = (e.clientX - canvasRect.left - camera.x) / camera.zoom;
      let y = (e.clientY - canvasRect.top - camera.y) / camera.zoom;

      if (useSettingsStore.getState().snapToGrid) {
        x = snapValue(x);
        y = snapValue(y);
      }

      if (!hasPaused) {
        adapter.pushUndoSnapshot();
        adapter.pauseHistory();
        hasPaused = true;
      }

      st.updateTrackNode(activeNodeDrag.trackId, activeNodeDrag.nodeId, { x, y });
    };

    const handleGlobalUp = () => {
      getCtxSt().setActiveNodeDrag(null);
      if (hasPaused) {
        if (canvasContext === 'playground') {
          (useStore as any).temporal.getState().resume();
        } else {
          adapter.commitHistory();
        }
      }
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [activeNodeDrag, adapter, canvasContext]);

  return (
    <>
      {tracks.map(track => {
        const isSelected = selectedTrackIds.includes(track.id) || (mode === 'draw_track' && activeTrackId === track.id);
        const isActive = activeTrackId === track.id || mode === 'draw_track' || isSelected;

        return (
          <BaseTrack
            key={track.id}
            track={track}
            isActive={isActive}
            isSelected={isSelected}
            isInteractive={true}
            isNodeDragging={activeNodeDrag !== null}
            onTrackPointerDown={(e: PIXI.FederatedPointerEvent) => {
              e.stopPropagation();
              const st = getCtxSt();
              const camera = st.camera;
              const x = (e.global.x - camera.x) / camera.zoom;
              const y = (e.global.y - camera.y) / camera.zoom;

              if (e.button === 0) {
                const now = Date.now();
                const last = lastClickMapRef.current[track.id] || 0;

                if (now - last < 300) {
                  st.openContextMenu({ x: e.clientX, y: e.clientY, blockId: `track:${track.id}` });
                  lastClickMapRef.current[track.id] = 0;
                } else {
                  lastClickMapRef.current[track.id] = now;
                }

                setIsTrackDragging({
                  trackId: track.id,
                  dragOffset: { x: x - track.nodes[0].x, y: y - track.nodes[0].y }
                });

                if (e.ctrlKey || e.shiftKey) {
                  st.selectTrack(track.id, true);
                } else if (!st.selectedTrackIds.includes(track.id)) {
                  st.selectTrack(track.id, false);
                }
              } else if (e.button === 2 && isSelected) {
                let minDist = Infinity;
                let insertIdx = 1;

                const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
                  const l2 = (x1 - x2)**2 + (y1 - y2)**2;
                  if (l2 === 0) return Math.hypot(px - x1, py - y1);
                  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
                  t = Math.max(0, Math.min(1, t));
                  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
                };

                for (let i = 0; i < track.nodes.length - 1; i++) {
                  const dist = distToSegment(x, y, track.nodes[i].x, track.nodes[i].y, track.nodes[i+1].x, track.nodes[i+1].y);
                  if (dist < minDist) { minDist = dist; insertIdx = i + 1; }
                }
                if (track.loop === true) {
                  const dist = distToSegment(x, y, track.nodes[track.nodes.length-1].x, track.nodes[track.nodes.length-1].y, track.nodes[0].x, track.nodes[0].y);
                  if (dist < minDist) { insertIdx = track.nodes.length; }
                }

                const newId = st.insertTrackNode(track.id, insertIdx, { x, y });
                st.setActiveNodeDrag({ trackId: track.id, nodeId: newId, isNewNode: true });
              }
            }}
            onNodeDragStart={(nodeId) => {
              getCtxSt().setActiveNodeDrag({ trackId: track.id, nodeId: nodeId });
            }}
            onNodeDoubleClick={(nodeId) => {
              const nodeIndex = track.nodes.findIndex((n: TrackNode) => n.id === nodeId);
              if (nodeIndex !== -1) {
                const st = getCtxSt();
                const updatedRunners = [...st.runners];
                const runnerIndex = updatedRunners.findIndex(r => r.trackId === track.id);
                if (runnerIndex !== -1) {
                  updatedRunners[runnerIndex] = { ...updatedRunners[runnerIndex], progress: nodeIndex };
                } else {
                  updatedRunners.push({ id: Math.random().toString(), trackId: track.id, progress: nodeIndex });
                }
                st.setRunners(updatedRunners);
              }
            }}
            onNodeRightClick={(nodeId) => {
              onNodeDeletedByDrag?.();
              const st = getCtxSt();
              if (!st.selectedTrackIds.includes(track.id)) {
                st.selectTrack(track.id, false);
              }
              st.removeTrackNode(track.id, nodeId);
            }}
          />
        );
      })}

      {/* Render Runners */}
      {runners.map(runner => {
        const track = tracks.find(t => t.id === runner.trackId);
        if (!track || track.nodes.length < 2 || track.enabled === false) return null;

        const isCircular = track.loop === true;
        const segmentsCount = isCircular ? track.nodes.length : track.nodes.length - 1;
        const segmentIndex = Math.min(Math.floor(runner.progress), segmentsCount - 1);
        const segmentT = runner.progress - segmentIndex;

        const cps = computeTrackControlPoints(track.nodes, isCircular);

        const p1 = track.nodes[segmentIndex];
        const p2 = track.nodes[(segmentIndex + 1) % track.nodes.length];
        const cp1 = cps[segmentIndex].controlOut;
        const cp2 = cps[(segmentIndex + 1) % track.nodes.length].controlIn;

        const cX = 3 * (cp1.x - p1.x);
        const bX = 3 * (cp2.x - cp1.x) - cX;
        const aX = p2.x - p1.x - cX - bX;

        const cY = 3 * (cp1.y - p1.y);
        const bY = 3 * (cp2.y - cp1.y) - cY;
        const aY = p2.y - p1.y - cY - bY;

        const x = (aX * Math.pow(segmentT, 3)) + (bX * Math.pow(segmentT, 2)) + (cX * segmentT) + p1.x;
        const y = (aY * Math.pow(segmentT, 3)) + (bY * Math.pow(segmentT, 2)) + (cY * segmentT) + p1.y;

        return (
          <pixiGraphics
            key={`runner-${runner.id}`}
            zIndex={30}
            draw={(g) => {
              g.clear();
              g.circle(x, y, 12);
              g.fill({ color: 0xec4899 });
              g.stroke({ width: 3, color: 0xffffff });
            }}
            eventMode="none"
          />
        );
      })}
    </>
  );
};
