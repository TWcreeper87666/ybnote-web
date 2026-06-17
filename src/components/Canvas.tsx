import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store/useStore';
import { NoteBlock } from './NoteBlock';
import { playNote } from '../utils/audio';
import { shiftPitch } from '../utils/pitchUtils';
import { TrackRenderer } from './TrackRenderer';
import { GroupRectRenderer } from './GroupRectRenderer';

export type TrailStroke = {
  id: number;
  points: { x: number, y: number, time: number }[];
};

const TrailRenderer: React.FC<{ 
  activeStrokesRef: React.MutableRefObject<TrailStroke[]>;
  currentStrokeId: React.MutableRefObject<number | null>;
}> = ({ activeStrokesRef, currentStrokeId }) => {
  const gRef = useRef<PIXI.Graphics>(null);

  useTick(() => {
    if (gRef.current) {
      const now = Date.now();
      const FADE_TIME = 500;
      
      // Remove old points and empty strokes
      activeStrokesRef.current.forEach(stroke => {
        if (stroke.id === currentStrokeId.current && stroke.points.length > 0) {
          // Keep the tip fresh while still dragging
          stroke.points[stroke.points.length - 1].time = now;
        }
        stroke.points = stroke.points.filter(p => now - p.time < FADE_TIME);
      });
      activeStrokesRef.current = activeStrokesRef.current.filter(s => s.points.length > 0);
      
      const g = gRef.current;
      g.clear();
      
      activeStrokesRef.current.forEach(stroke => {
        const points = stroke.points;

        // Draw micro-segments for smooth width tapering
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const steps = Math.max(1, Math.ceil(dist / 8)); // micro-segment every 8 pixels
          
          for (let j = 0; j < steps; j++) {
            const t1 = j / steps;
            const t2 = (j + 1) / steps;
            
            const x1 = p1.x + (p2.x - p1.x) * t1;
            const y1 = p1.y + (p2.y - p1.y) * t1;
            const x2 = p1.x + (p2.x - p1.x) * t2;
            const y2 = p1.y + (p2.y - p1.y) * t2;
            
            const midTime = p1.time + (p2.time - p1.time) * ((t1 + t2) / 2);
            const age = now - midTime;
            const life = Math.max(0, 1 - (age / FADE_TIME));
            const easeLife = life * life * life; // Sharp tapering

            // Glow
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke({ width: 25 * easeLife, color: 0x8b5cf6, alpha: 0.3, cap: 'round' });
            
            // Core
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke({ width: 8 * easeLife, color: 0xffffff, alpha: 1, cap: 'round' });
          }
        }
      });
    }
  });

  return <pixiGraphics ref={gRef} draw={() => {}} eventMode="none" />;
};

export const Canvas: React.FC = () => {
  const { blocks, camera, updateCamera, showGrid, theme } = useStore();
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [groupDrawBox, setGroupDrawBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [groupDrawStart, setGroupDrawStart] = useState<{x: number, y: number} | null>(null);
  const groupDrawBoxRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const containerRef = useRef<PIXI.Container>(null);
  const activeStrokesRef = useRef<TrailStroke[]>([]);

  const finishGroupDraw = useCallback(() => {
    const box = groupDrawBoxRef.current;
    if (box) {
      if (box.w > 10 && box.h > 10) {
        useStore.getState().addGroupRect({ x: box.x, y: box.y, w: box.w, h: box.h });
      } else {
        // Default size if just single clicked
        useStore.getState().addGroupRect({ x: box.x - 100, y: box.y - 100, w: 200, h: 200 });
      }
      groupDrawBoxRef.current = null;
    }
    setGroupDrawBox(null);
    setGroupDrawStart(null);
  }, []);
  const nextStrokeId = useRef(0);
  const currentStrokeId = useRef<number | null>(null);

  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{x: number, y: number} | null>(null);

  const intersectedBlocksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleGlobalUp = (e: PointerEvent) => {
      setIsPanning(false);
      setSelectionStart(null);
      setSelectionBox(null);
      
      finishGroupDraw();

      if (e.button === 2 || e.buttons === 0) {
        intersectedBlocksRef.current.clear();
        currentStrokeId.current = null;
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, []);

  // Attach non-passive wheel listener to document to prevent zooming the entire page
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const state = useStore.getState();
      if (state.hoveredBlockId && !e.ctrlKey) {
        e.preventDefault();
        const isVolume = e.shiftKey;
        const delta = e.deltaY > 0 ? -1 : 1;
        
        state.mutateBlocks(
          [state.hoveredBlockId as string],
          (b) => {
            if (isVolume) {
              const newVolume = Math.max(0, Math.min(1, (b.volume ?? 1) + delta * 0.1));
              return { volume: newVolume, playedAt: Date.now() };
            } else {
              const newPitch = shiftPitch(b.pitch, delta);
              let newName = b.name;
              if (b.instrument === 'percussion' && ['kick', 'snare', 'hihat', 'tom', 'cymbal'].includes(newPitch)) {
                newName = newPitch.charAt(0).toUpperCase() + newPitch.slice(1);
              }
              return { pitch: newPitch, name: newName, playedAt: Date.now() };
            }
          },
          { continuous: true }
        );
      } else {
        e.preventDefault();
        const zoomFactor = 1.1;
        const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        
        const oldZoom = state.camera.zoom;
        let newZoom = oldZoom * direction;
        newZoom = Math.min(Math.max(newZoom, 0.1), 5); // Clamp zoom
        
        const globalX = e.clientX;
        const globalY = e.clientY;
        const localX = (globalX - state.camera.x) / oldZoom;
        const localY = (globalY - state.camera.y) / oldZoom;
        
        const newCameraX = globalX - localX * newZoom;
        const newCameraY = globalY - localY * newZoom;

        state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      }
    };
    document.addEventListener('wheel', handler, { passive: false });
    return () => document.removeEventListener('wheel', handler);
  }, []);

  const lineIntersectsRect = (x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) => {
    if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true;
    if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true;

    const intersects = (x3: number, y3: number, x4: number, y4: number) => {
      const denom = (y4-y3)*(x2-x1) - (x4-x3)*(y2-y1);
      if (denom === 0) return false;
      const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / denom;
      const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / denom;
      return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
    };

    if (intersects(rx, ry, rx+rw, ry)) return true; 
    if (intersects(rx, ry+rh, rx+rw, ry+rh)) return true; 
    if (intersects(rx, ry, rx, ry+rh)) return true; 
    if (intersects(rx+rw, ry, rx+rw, ry+rh)) return true; 

    return false;
  };

  const checkTrailIntersection = (x1: number, y1: number, x2: number, y2: number, isFirstPoint = false, startedOnBlock = false) => {
    const state = useStore.getState();
    const blocks = state.blocks;
    const groupRects = state.groupRects;
    
    const currentFrameIntersected = new Set<string>();

    blocks.forEach(b => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
          playNote(b.pitch, b.volume ?? 1, b.instrument ?? 'piano');
          state.updateBlock(b.id, { playedAt: Date.now() });
        }
      }
    });

    groupRects.forEach(g => {
      if (lineIntersectsRect(x1, y1, x2, y2, g.x, g.y, g.w, g.h)) {
        currentFrameIntersected.add(`groupRect:${g.id}`);
        if (!intersectedBlocksRef.current.has(`groupRect:${g.id}`)) {
          if (isFirstPoint && startedOnBlock) {
             // Do not trigger, just mark as visited (which happens by adding to currentFrameIntersected)
          } else {
            state.updateGroupRect(g.id, { playedAt: Date.now() });
            
            const isInside = (bx: number, by: number, bw: number, bh: number) => {
              return bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;
            };
            
            const blocksInside = state.blocks.filter(b => isInside(b.x, b.y, 60, 60));
            if (blocksInside.length > 0) {
              state.updateBlocks(blocksInside.map(b => ({
                id: b.id,
                updates: { playedAt: Date.now() }
              })));
            }
          }
        }
      }
    });

    intersectedBlocksRef.current = currentFrameIntersected;
  };

  const handlePointerDown = (e: any) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const button = e.button;
    if (button === 1) { // Middle click to pan
      setIsPanning(true);
      const pos = e.global;
      setPanStart({ x: pos.x - camera.x, y: pos.y - camera.y });
    } else if (button === 0) {
      const state = useStore.getState();

      if (state.mode === 'draw_track') {
        if (e.target && e.target.label === 'background') {
          const pos = e.currentTarget.toLocal(e.global);
          let trackId = state.activeTrackId;
          if (!trackId) {
            trackId = state.addTrack({ nodes: [], bpm: 120, loop: false });
            state.setActiveTrackId(trackId);
          }
          const nodeId = state.addTrackNode(trackId, { x: pos.x, y: pos.y });
          state.setActiveNodeDrag({ trackId, nodeId });
          if (e.pointerId !== undefined && e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
          }
        }
        return;
      }

      if (state.mode === 'draw_group') {
        if (e.target && e.target.label === 'background') {
          const pos = e.currentTarget.toLocal(e.global);
          setGroupDrawStart({ x: pos.x, y: pos.y });
          const newBox = { x: pos.x, y: pos.y, w: 0, h: 0 };
          setGroupDrawBox(newBox);
          groupDrawBoxRef.current = newBox;
          if (e.pointerId !== undefined && e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
          }
        }
        return;
      }

      if (e.target && e.target.label === 'background') {
        const now = Date.now();
        const posLocal = e.currentTarget.toLocal(e.global);
        const timeDiff = now - lastClickTimeRef.current;
        
        // Double click to spawn a noteblock (ignore < 50ms as it's likely a duplicate event)
        if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
          const dx = posLocal.x - lastClickPosRef.current.x;
          const dy = posLocal.y - lastClickPosRef.current.y;
          if (Math.hypot(dx, dy) < 20) {
            if (state.mode === 'drum') {
              state.addBlock({ pitch: 'kick', x: posLocal.x - 30, y: posLocal.y - 30, instrument: 'percussion', volume: 1, name: 'Kick' });
            } else {
              state.addBlock({ pitch: 'C4', x: posLocal.x - 30, y: posLocal.y - 30, instrument: 'piano', volume: 1, name: 'Note' });
            }
            lastClickTimeRef.current = 0; // reset
            return;
          }
        }
        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x: posLocal.x, y: posLocal.y };

        if (!e.ctrlKey && !e.shiftKey) {
          state.clearSelection();
        }
        // Start marquee selection on left click
        const pos = e.currentTarget.toLocal(e.global);
        setSelectionStart({ x: pos.x, y: pos.y });
        setSelectionBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
        if (e.pointerId !== undefined && e.target.setPointerCapture) {
          e.target.setPointerCapture(e.pointerId);
        }
      }
    } else if (button === 2) {
      if (e.target && e.target.label === 'background') {
        useStore.getState().clearSelection();
      }
      const pos = e.currentTarget.toLocal(e.global);
      const id = nextStrokeId.current++;
      currentStrokeId.current = id;
      activeStrokesRef.current.push({
        id,
        points: [{ x: pos.x, y: pos.y, time: Date.now() }]
      });
      let startedOnBlock = false;
      let current = e.target as any;
      while (current) {
        if (current.label === 'note-block') {
          startedOnBlock = true;
          break;
        }
        current = current.parent;
      }
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(pos.x, pos.y, pos.x, pos.y, true, startedOnBlock);
    }
    
    useStore.getState().closeContextMenu();
  };

  const handlePointerMove = (e: any) => {
    if (isPanning) {
      const pos = e.global;
      updateCamera({
        x: pos.x - panStart.x,
        y: pos.y - panStart.y,
      });
    } else if (groupDrawStart) {
      const pos = e.currentTarget.toLocal(e.global);
      const x = Math.min(groupDrawStart.x, pos.x);
      const y = Math.min(groupDrawStart.y, pos.y);
      const w = Math.abs(pos.x - groupDrawStart.x);
      const h = Math.abs(pos.y - groupDrawStart.y);
      const newBox = { x, y, w, h };
      setGroupDrawBox(newBox);
      groupDrawBoxRef.current = newBox;
    } else if (selectionStart) {
      const pos = e.currentTarget.toLocal(e.global);
      const x = Math.min(selectionStart.x, pos.x);
      const y = Math.min(selectionStart.y, pos.y);
      const w = Math.abs(pos.x - selectionStart.x);
      const h = Math.abs(pos.y - selectionStart.y);
      setSelectionBox({ x, y, w, h });
      
      const blocks = useStore.getState().blocks;
      const selectedIds = blocks.filter(b => {
        return b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y;
      }).map(b => b.id);
      
      const tracks = useStore.getState().tracks;
      const selectedTIds = tracks.filter(t => {
        return t.nodes.some(n => n.x >= x && n.x <= x + w && n.y >= y && n.y <= y + h);
      }).map(t => t.id);

      const groupRects = useStore.getState().groupRects;
      const selectedGIds = groupRects.filter(g => {
        return g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y;
      }).map(g => g.id);
      
      useStore.setState({ selectedBlockIds: selectedIds, selectedTrackIds: selectedTIds, selectedGroupRectIds: selectedGIds });
    } else if (e.buttons === 2) {
      const pos = e.currentTarget.toLocal(e.global);
      if (currentStrokeId.current !== null) {
        const stroke = activeStrokesRef.current.find(s => s.id === currentStrokeId.current);
        if (stroke && stroke.points.length > 0) {
          const prev = stroke.points[stroke.points.length - 1];
          stroke.points.push({ x: pos.x, y: pos.y, time: Date.now() });
          checkTrailIntersection(prev.x, prev.y, pos.x, pos.y);
        }
      }
    }
  };

  const handlePointerUp = (e: any) => {
    setIsPanning(false);
    setSelectionStart(null);
    setSelectionBox(null);
    
    finishGroupDraw();

    if (e.pointerId !== undefined && e.target && e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };

  const drawBackground = (g: PIXI.Graphics) => {
    g.clear();
    // Hit area covering the whole screen so we can detect drag anywhere
    g.rect(-10000, -10000, 20000, 20000); 
    g.fill({ color: 0x000000, alpha: 0.001 }); // Almost transparent

    // Draw grid if enabled
    if (showGrid) {
      const isDark = theme === 'dark';
      const gridColor = isDark ? 0xffffff : 0x000000;
      const gridAlpha = isDark ? 0.1 : 0.05;
      
      const gridSize = 60;
      const size = 5000;
      const startPos = Math.floor(-size / gridSize) * gridSize;
      const endPos = Math.ceil(size / gridSize) * gridSize;
      
      for (let x = startPos; x <= endPos; x += gridSize) {
        g.moveTo(x, startPos);
        g.lineTo(x, endPos);
      }
      for (let y = startPos; y <= endPos; y += gridSize) {
        g.moveTo(startPos, y);
        g.lineTo(endPos, y);
      }
      
      g.stroke({ width: 1, color: gridColor, alpha: gridAlpha });
    }
  };

  const drawSelectionBox = (g: PIXI.Graphics) => {
    g.clear();
    if (selectionBox) {
      g.rect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      g.fill({ color: 0x6366f1, alpha: 0.2 });
      g.stroke({ width: 1, color: 0x6366f1, alpha: 0.8 });
    }
  };

  const drawGroupDrawBox = (g: PIXI.Graphics) => {
    g.clear();
    if (groupDrawBox) {
      g.roundRect(groupDrawBox.x, groupDrawBox.y, groupDrawBox.w, groupDrawBox.h, 16);
      g.fill({ color: 0x4f46e5, alpha: 0.15 });
      g.stroke({ width: 2, color: 0x6366f1, alpha: 0.5 });
    }
  };

  return (
    <div 
      style={{ width: '100%', height: '100%' }} 
    >
      <Application 
        backgroundAlpha={0}
        resizeTo={window} 
        antialias={true}
      >
        <pixiContainer
          ref={containerRef as any}
          x={camera.x}
          y={camera.y}
          scale={camera.zoom}
          eventMode="static"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerUpOutside={handlePointerUp}
        >
          {/* Background Hit Area for dragging the canvas */}
          <pixiGraphics 
            label="background"
            draw={drawBackground} 
            eventMode="static"
          />
          
          <pixiGraphics draw={drawSelectionBox} eventMode="none" />
          <pixiGraphics draw={drawGroupDrawBox} eventMode="none" />

          <GroupRectRenderer />

          {/* Render all blocks */}
          {blocks.map(block => (
            <NoteBlock 
              key={block.id} 
              id={block.id} 
              x={block.x} 
              y={block.y} 
              pitch={block.pitch}
            />
          ))}

          <TrackRenderer />
          <TrailRenderer activeStrokesRef={activeStrokesRef} currentStrokeId={currentStrokeId} />
        </pixiContainer>
      </Application>
    </div>
  );
};
