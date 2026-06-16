import React, { useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store/useStore';
import { computeTrackControlPoints } from '../utils/spline';

const TrackHandle: React.FC<{
  x: number;
  y: number;
  color: number;
  onDragStart: (e: PIXI.FederatedPointerEvent) => void;
  onRightClick: (e: PIXI.FederatedPointerEvent) => void;
}> = ({ x, y, color, onDragStart, onRightClick }) => {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.circle(0, 0, 8);
    g.fill({ color: 0xffffff });
    g.stroke({ width: 3, color });
    
    // larger hit area
    g.circle(0, 0, 16);
    g.fill({ color: 0x000000, alpha: 0.001 });
  }, [color]);

  return (
    <pixiGraphics
      x={x}
      y={y}
      draw={draw}
      eventMode="static"
      cursor="pointer"
      onPointerDown={(e) => { 
        e.stopPropagation(); 
        if (e.button === 0) onDragStart(e); 
        else if (e.button === 2) onRightClick(e);
      }}
    />
  );
};

export const TrackRenderer: React.FC = () => {
  const { tracks, runners, mode, activeTrackId, selectedTrackIds, setEditingTrackId, activeNodeDrag, setActiveNodeDrag, removeTrackNode } = useStore();
  
  const [isTrackDragging, setIsTrackDragging] = useState<{ trackId: string, dragOffset: { x: number, y: number } } | null>(null);

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
    
    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({...n}))]));

    const handleGlobalMove = (e: PointerEvent) => {
      const state = useStore.getState();
      const camera = state.camera;
      
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;
      
      let newX = localX - isTrackDragging.dragOffset.x;
      let newY = localY - isTrackDragging.dragOffset.y;
      
      if (state.snapToGrid) {
        const gridSize = 60;
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }
      
      const initNodes = initialTrackNodes.get(isTrackDragging.trackId);
      if (!initNodes || initNodes.length === 0) return;
      
      const deltaX = newX - initNodes[0].x;
      const deltaY = newY - initNodes[0].y;
      
      let actuallyMoved = false;
      const finalUpdates = selectedBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        const targetX = init.x + deltaX;
        const targetY = init.y + deltaY;
        if (targetX !== init.x || targetY !== init.y) { actuallyMoved = true; }
        return { id: b.id, updates: { x: targetX, y: targetY } };
      });
      
      const trackUpdates = selectedTracks.map(t => {
        const initNodes = initialTrackNodes.get(t.id)!;
        const newNodes = initNodes.map(n => {
          const targetX = n.x + deltaX;
          const targetY = n.y + deltaY;
          if (targetX !== n.x || targetY !== n.y) { actuallyMoved = true; }
          return { ...n, x: targetX, y: targetY };
        });
        return { id: t.id, nodes: newNodes };
      });

      if (!actuallyMoved) return;

      if (!hasPaused) {
        useStore.temporal.setState(s => ({
          pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, tracks: state.tracks }],
          futureStates: []
        }));
        useStore.temporal.getState().pause();
        hasPaused = true;
      }

      state.updateBlocks(finalUpdates);
      trackUpdates.forEach(tu => {
        state.updateTrack(tu.id, { nodes: tu.nodes });
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
  }, [isTrackDragging]);

  // Node Dragging
  React.useEffect(() => {
    if (!activeNodeDrag) return;
    
    let hasPaused = false;

    const handleGlobalMove = (e: PointerEvent) => {
       const state = useStore.getState();
       const camera = state.camera;
       let x = (e.clientX - camera.x) / camera.zoom;
       let y = (e.clientY - camera.y) / camera.zoom;

       if (state.snapToGrid) {
         const gridSize = 60;
         x = Math.round(x / gridSize) * gridSize;
         y = Math.round(y / gridSize) * gridSize;
       }

       if (!hasPaused) {
         useStore.temporal.setState(s => ({
           pastStates: [...s.pastStates, { blocks: state.blocks, groups: state.groups, tracks: state.tracks }],
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
        const isSelected = selectedTrackIds.includes(track.id);
        const isActive = activeTrackId === track.id || mode === 'draw_track' || isSelected;
        
        return (
          <pixiContainer key={track.id}>
            <TrackPath track={track} isActive={isActive} isSelected={isSelected} />
            
            {/* Invisible thick path for double click hit detection */}
            <pixiGraphics 
              eventMode="static"
              cursor="pointer"
              draw={(g) => {
                g.clear();
                if (track.nodes.length === 0) return;
                const cps = computeTrackControlPoints(track.nodes, track.loop);

                g.moveTo(track.nodes[0].x, track.nodes[0].y);
                for (let i = 1; i < track.nodes.length; i++) {
                  const p2 = track.nodes[i];
                  const cp1 = cps[i - 1].controlOut;
                  const cp2 = cps[i].controlIn;
                  g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
                }
                if (track.loop && track.nodes.length > 2) {
                  const p2 = track.nodes[0];
                  const cp1 = cps[track.nodes.length - 1].controlOut;
                  const cp2 = cps[0].controlIn;
                  g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
                }
                g.stroke({ width: 12, color: 0x000000, alpha: 0.001 }); // invisible hit area (reduced size)
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const state = useStore.getState();
                const camera = state.camera;
                const x = (e.global.x - camera.x) / camera.zoom;
                const y = (e.global.y - camera.y) / camera.zoom;
                
                if (e.button === 0) { // Left click
                  const now = Date.now();
                  const last = (e as any).lastClickTime || 0;
                  if (now - last < 300) {
                    setEditingTrackId(track.id);
                  }
                  (e as any).lastClickTime = now;
                  
                  setIsTrackDragging({ 
                    trackId: track.id, 
                    dragOffset: { x: x - track.nodes[0].x, y: y - track.nodes[0].y } 
                  });
                  
                  if (e.ctrlKey || e.shiftKey) {
                    state.selectTrack(track.id, true);
                  } else if (!state.selectedTrackIds.includes(track.id)) {
                    state.selectTrack(track.id, false);
                  }
                } else if (e.button === 2) { // Right click
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
                  if (track.loop) {
                    const dist = distToSegment(x, y, track.nodes[track.nodes.length-1].x, track.nodes[track.nodes.length-1].y, track.nodes[0].x, track.nodes[0].y);
                    if (dist < minDist) { minDist = dist; insertIdx = track.nodes.length; }
                  }
                  
                  const newId = state.insertTrackNode(track.id, insertIdx, { x, y });
                  state.setActiveNodeDrag({ trackId: track.id, nodeId: newId });
                }
              }}
            />

            {isActive && track.nodes.map((node) => (
              <React.Fragment key={node.id}>
                {/* Main Node */}
                <TrackHandle 
                  x={node.x} y={node.y} color={0x6366f1} 
                  onDragStart={() => {
                    setActiveNodeDrag({ trackId: track.id, nodeId: node.id });
                  }}
                  onRightClick={() => {
                    removeTrackNode(track.id, node.id);
                  }}
                />
              </React.Fragment>
            ))}
          </pixiContainer>
        );
      })}

      {/* Render Runners */}
      {runners.map(runner => {
        const track = visualTracks.find(t => t.id === runner.trackId);
        if (!track || track.nodes.length < 2) return null;
        
        const segmentsCount = track.loop ? track.nodes.length : track.nodes.length - 1;
        const segmentIndex = Math.min(Math.floor(runner.progress), segmentsCount - 1);
        const segmentT = runner.progress - segmentIndex;
        
        const cps = computeTrackControlPoints(track.nodes, track.loop);

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

const TrackPath: React.FC<{ track: any; isActive: boolean; isSelected: boolean }> = ({ track, isActive, isSelected }) => {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (track.nodes.length === 0) return;

    const cps = computeTrackControlPoints(track.nodes, track.loop);
    const color = isSelected ? 0xec4899 : (isActive ? 0x6366f1 : 0x9ca3af);
    const alpha = isActive ? 1 : 0.5;

    g.moveTo(track.nodes[0].x, track.nodes[0].y);
    for (let i = 1; i < track.nodes.length; i++) {
      const p2 = track.nodes[i];
      const cp1 = cps[i - 1].controlOut;
      const cp2 = cps[i].controlIn;
      g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    }
    if (track.loop && track.nodes.length > 2) {
      const p2 = track.nodes[0];
      const cp1 = cps[track.nodes.length - 1].controlOut;
      const cp2 = cps[0].controlIn;
      g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    }

    g.stroke({ width: 6, color, alpha });

    if (track.nodes.length > 1) {
      const n = track.nodes.length;
      let p2 = cps[n - 1].controlIn;
      let endPoint = track.nodes[n - 1];

      if (track.loop && n > 2) {
        p2 = cps[0].controlIn;
        endPoint = track.nodes[0];
      }

      let dx = endPoint.x - p2.x;
      let dy = endPoint.y - p2.y;
      if (dx === 0 && dy === 0) {
        const prev = track.loop && n > 2 ? track.nodes[n - 1] : track.nodes[n - 2];
        dx = endPoint.x - prev.x;
        dy = endPoint.y - prev.y;
      }
      
      const angle = Math.atan2(dy, dx);
      const size = 16;
      const shift = size * 0.8 + 4;
      const cx = endPoint.x + Math.cos(angle) * shift;
      const cy = endPoint.y + Math.sin(angle) * shift;

      g.poly([
        cx + Math.cos(angle) * size, cy + Math.sin(angle) * size,
        cx + Math.cos(angle + Math.PI * 0.8) * size, cy + Math.sin(angle + Math.PI * 0.8) * size,
        cx + Math.cos(angle - Math.PI * 0.8) * size, cy + Math.sin(angle - Math.PI * 0.8) * size,
      ]);
      g.fill({ color, alpha });
    }
  }, [track, isActive, isSelected]);

  return <pixiGraphics draw={draw} eventMode="none" />;
};
