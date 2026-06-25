import React, { useState } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { computeTrackControlPoints } from '../../utils/spline';
import { BaseTrack } from './BaseTrack';
import type { TrackNode } from '../../types';

export const TrackRenderer: React.FC = () => {
  const { tracks, runners, mode, activeTrackId, selectedTrackIds, activeNodeDrag, setActiveNodeDrag, removeTrackNode, updateBlocks, updateTrack, updateGroupRect } = useStore();
  
  const [isTrackDragging, setIsTrackDragging] = useState<{ trackId: string, dragOffset: { x: number, y: number } } | null>(null);
  const lastClickMapRef = React.useRef<Record<string, number>>({});

  // Unified Track Dragging
  React.useEffect(() => {
    if (!isTrackDragging) return;
    
    let hasPaused = false;
    const state = useStore.getState();
    const selectedBlocks = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
    const selectedTracks = state.tracks.filter(t => state.selectedTrackIds.includes(t.id));
    if (!selectedTracks.find(t => t.id === isTrackDragging.trackId)) {
      const thisTrack = state.tracks.find(t => t.id === isTrackDragging.trackId);
      if (thisTrack) selectedTracks.push(thisTrack);
    }
    const selectedGroupRects = state.groupRects.filter(g => state.selectedGroupRectIds.includes(g.id));
    
    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({...n}))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const handleGlobalMove = (e: PointerEvent) => {
      const state = useStore.getState();
      const camera = state.camera;
      
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;
      
      let newX = localX - isTrackDragging.dragOffset.x;
      let newY = localY - isTrackDragging.dragOffset.y;
      
      if (useSettingsStore.getState().snapToGrid) {
        const snapSize = 30;
        newX = Math.round(newX / snapSize) * snapSize;
        newY = Math.round(newY / snapSize) * snapSize;
      }
      
      const initNodes = initialTrackNodes.get(isTrackDragging.trackId);
      if (!initNodes || initNodes.length === 0) return;
      
      const deltaX = newX - initNodes[0].x;
      const deltaY = newY - initNodes[0].y;
      
      const currentTrack = state.tracks.find(st => st.id === isTrackDragging.trackId);
      if (currentTrack && currentTrack.nodes.length > 0 && 
          (initNodes[0].x + deltaX) === currentTrack.nodes[0].x && 
          (initNodes[0].y + deltaY) === currentTrack.nodes[0].y) {
        return;
      }
      
      const finalUpdates = selectedBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
      });
      
      const trackUpdates = selectedTracks.map(t => {
        const trackInitNodes = initialTrackNodes.get(t.id)!;
        const newNodes = trackInitNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY }));
        return { id: t.id, nodes: newNodes };
      });

      if (!hasPaused) {
        useStore.temporal.setState(s => ({
          pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks }],
          futureStates: []
        }));
        useStore.temporal.getState().pause();
        hasPaused = true;
      }

      updateBlocks(finalUpdates);
      trackUpdates.forEach(tu => {
        updateTrack(tu.id, { nodes: tu.nodes });
      });
      selectedGroupRects.forEach(g => {
        const init = initialGroupRects.get(g.id)!;
        updateGroupRect(g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsTrackDragging(null);
      if (hasPaused) {
        useStore.temporal.getState().resume();
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
  }, [isTrackDragging, updateBlocks, updateTrack, updateGroupRect]);

  // Node Dragging
  React.useEffect(() => {
    if (!activeNodeDrag) return;
    
    let hasPaused = false;

    // When a brand-new node was just created (isNewNode flag), absorb that creation
    // history entry so that click+drag becomes ONE atomic undo action.
    // For existing nodes being dragged, use the normal pause/resume path.
    if (activeNodeDrag.isNewNode) {
      const temporal = useStore.temporal.getState();
      if (temporal.pastStates.length > 0) {
        const preCreationSnapshot = temporal.pastStates[temporal.pastStates.length - 1];
        // Pop the entry added by addTrackNode/insertTrackNode
        useStore.temporal.setState(s => ({
          pastStates: s.pastStates.slice(0, -1),
          futureStates: []
        }));
        // Re-push the pre-creation snapshot as the baseline, then pause
        useStore.temporal.setState(s => ({
          pastStates: [...s.pastStates, preCreationSnapshot],
          futureStates: []
        }));
        useStore.temporal.getState().pause();
        hasPaused = true;
      }
    }

    const handleGlobalMove = (e: PointerEvent) => {
       const state = useStore.getState();
       const camera = state.camera;
       let x = (e.clientX - camera.x) / camera.zoom;
       let y = (e.clientY - camera.y) / camera.zoom;

       if (useSettingsStore.getState().snapToGrid) {
         const snapSize = 30;
         x = Math.round(x / snapSize) * snapSize;
         y = Math.round(y / snapSize) * snapSize;
       }

       if (!hasPaused) {
         useStore.temporal.setState(s => ({
           pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, groupRects: state.groupRects, tracks: state.tracks }],
           futureStates: []
         }));
         useStore.temporal.getState().pause();
         hasPaused = true;
       }

       state.updateTrackNode(activeNodeDrag.trackId, activeNodeDrag.nodeId, { x, y });
    };
    
    const handleGlobalUp = () => {
       setActiveNodeDrag(null);
       if (hasPaused) {
         useStore.temporal.getState().resume();
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
  }, [activeNodeDrag, setActiveNodeDrag]);



  const visualTracks = tracks;

  return (
    <>
      {visualTracks.map(track => {
        const isSelected = selectedTrackIds.includes(track.id) || (mode === 'draw_track' && activeTrackId === track.id);
        const isActive = activeTrackId === track.id || mode === 'draw_track' || isSelected;
        
        return (
          <BaseTrack
            key={track.id}
            track={track}
            isActive={isActive}
            isSelected={isSelected}
            isInteractive={true}
            onTrackPointerDown={(e: PIXI.FederatedPointerEvent) => {
                e.stopPropagation();
                const state = useStore.getState();
                const camera = state.camera;
                const x = (e.global.x - camera.x) / camera.zoom;
                const y = (e.global.y - camera.y) / camera.zoom;
                
                if (e.button === 0) { // Left click
                  const now = Date.now();
                  const last = lastClickMapRef.current[track.id] || 0;
                  
                  if (now - last < 300) {
                    state.openContextMenu({ x: e.clientX, y: e.clientY, blockId: `track:${track.id}` });
                    lastClickMapRef.current[track.id] = 0;
                  } else {
                    lastClickMapRef.current[track.id] = now;
                  }
                  
                  
                  setIsTrackDragging({ 
                    trackId: track.id, 
                    dragOffset: { x: x - track.nodes[0].x, y: y - track.nodes[0].y } 
                  });
                  
                  if (e.ctrlKey || e.shiftKey) {
                    state.selectTrack(track.id, true);
                  } else if (!state.selectedTrackIds.includes(track.id)) {
                    state.selectTrack(track.id, false);
                  }
                } else if (e.button === 2 && isSelected) { // Right click
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
                  
                  const newId = state.insertTrackNode(track.id, insertIdx, { x, y });
                  state.setActiveNodeDrag({ trackId: track.id, nodeId: newId, isNewNode: true });
                }
            }}
            onNodeDragStart={(nodeId) => {
                setActiveNodeDrag({ trackId: track.id, nodeId: nodeId });
            }}
            onNodeDoubleClick={(nodeId) => {
              const nodeIndex = track.nodes.findIndex((n: TrackNode) => n.id === nodeId);
              if (nodeIndex !== -1) {
                const state = useStore.getState();
                const updatedRunners = [...state.runners];
                const runnerIndex = updatedRunners.findIndex(r => r.trackId === track.id);
                if (runnerIndex !== -1) {
                  updatedRunners[runnerIndex] = { ...updatedRunners[runnerIndex], progress: nodeIndex };
                } else {
                  updatedRunners.push({ id: Math.random().toString(), trackId: track.id, progress: nodeIndex });
                }
                state.setRunners(updatedRunners);
              }
            }}
            onNodeRightClick={(nodeId) => {
                const state = useStore.getState();
                if (!state.selectedTrackIds.includes(track.id)) {
                  state.selectTrack(track.id, false);
                }
                removeTrackNode(track.id, nodeId);
            }}
          />
        );
      })}

      {/* Render Runners */}
      {runners.map(runner => {
        const track = visualTracks.find(t => t.id === runner.trackId);
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

