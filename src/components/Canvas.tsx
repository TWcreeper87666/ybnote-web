import React, { useEffect, useRef, useState } from 'react';
import { Application, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store/useStore';
import { NoteBlock } from './NoteBlock';
import { playNote } from '../utils/audio';

export type TrailStroke = {
  id: number;
  points: { x: number, y: number, time: number }[];
};

const TrailRenderer: React.FC<{ activeStrokesRef: React.MutableRefObject<TrailStroke[]> }> = ({ activeStrokesRef }) => {
  const gRef = useRef<PIXI.Graphics>(null);

  useTick(() => {
    if (gRef.current) {
      const now = Date.now();
      const FADE_TIME = 500;
      
      // Remove old points and empty strokes
      activeStrokesRef.current.forEach(stroke => {
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
  const containerRef = useRef<PIXI.Container>(null);
  const activeStrokesRef = useRef<TrailStroke[]>([]);
  const nextStrokeId = useRef(0);
  const currentStrokeId = useRef<number | null>(null);

  const intersectedBlocksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleGlobalUp = (e: PointerEvent) => {
      setIsPanning(false);
      setSelectionStart(null);
      setSelectionBox(null);
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
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomFactor = 1.1;
        const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        
        const state = useStore.getState();
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

  const checkTrailIntersection = (x1: number, y1: number, x2: number, y2: number) => {
    const state = useStore.getState();
    const blocks = state.blocks;
    
    const currentFrameIntersected = new Set<string>();

    blocks.forEach(b => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
          playNote(b.pitch);
          state.updateBlock(b.id, { playedAt: Date.now() });
        }
      }
    });

    intersectedBlocksRef.current = currentFrameIntersected;
  };

  const handlePointerDown = (e: any) => {
    const button = e.button;
    if (button === 1) { // Middle click to pan
      setIsPanning(true);
      const pos = e.global;
      setPanStart({ x: pos.x - camera.x, y: pos.y - camera.y });
    } else if (button === 0) {
      if (e.target && e.target.label === 'background') {
        if (!e.ctrlKey && !e.shiftKey) {
          useStore.getState().clearSelection();
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
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(pos.x, pos.y, pos.x, pos.y);
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
      
      useStore.setState({ selectedBlockIds: selectedIds });
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

          <TrailRenderer activeStrokesRef={activeStrokesRef} />
        </pixiContainer>
      </Application>
    </div>
  );
};
