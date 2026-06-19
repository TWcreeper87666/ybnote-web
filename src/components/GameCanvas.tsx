import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../store/useStore';
import { getPitchColorNumber } from '../utils/colors';
import { playNote } from '../utils/audio';
import { BaseBlock } from './BaseBlock';

const APPROACH_TIME = 800; // ms before the event that the circle appears
const HIT_WINDOW = 200; // ms window for perfect hit

interface ApproachCircleProps {
  x: number;
  y: number;
  progress: number; // 0 to 1
  color: number;
}

const ApproachCircleComponent: React.FC<ApproachCircleProps> = ({ x, y, progress, color }) => {
  const gRef = useRef<PIXI.Graphics>(null);

  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const size = 60 + (1 - progress) * 150; // Starts large, shrinks to 60
    const alpha = Math.min(1, progress * 2);
    
    const offset = (size - 60) / 2;
    g.roundRect(-offset, -offset, size, size, 8);
    g.stroke({ width: 4, color, alpha });
  }, [progress, color]);

  return (
    <pixiContainer x={x} y={y}>
       <pixiGraphics ref={gRef} draw={draw} />
    </pixiContainer>
  );
};

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
      
      activeStrokesRef.current.forEach(stroke => {
        if (stroke.id === currentStrokeId.current && stroke.points.length > 0) {
          stroke.points[stroke.points.length - 1].time = now;
        }
        stroke.points = stroke.points.filter(p => now - p.time < FADE_TIME);
      });
      activeStrokesRef.current = activeStrokesRef.current.filter(s => s.points.length > 0);
      
      const g = gRef.current;
      g.clear();
      
      activeStrokesRef.current.forEach(stroke => {
        const points = stroke.points;
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const steps = Math.max(1, Math.ceil(dist / 8)); 
          
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
            const easeLife = life * life * life; 

            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.stroke({ width: 25 * easeLife, color: 0x8b5cf6, alpha: 0.3, cap: 'round' });
            
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

export const GameCanvas: React.FC = () => {
  const { gameBlocks, gameEvents, camera, theme, gameState, updateGameBlock, setGameStats, gameResetCount, showGrid, showBlockPitch, showBlockInstrument, showBlockVolume, blockOpacity } = useStore();
  
  const gameTimeRef = useRef(-2000);
  const lastTickTimeRef = useRef(Date.now());
  const pendingEventsRef = useRef([...gameEvents].sort((a, b) => a.time - b.time));
  const activeCirclesRef = useRef<{ id: string, eventTime: number, x: number, y: number, color: number, progress: number, blockId: string, pitch: string, instrument: string }[]>([]);
  const [activeCirclesState, setActiveCirclesState] = useState(activeCirclesRef.current);
  const tickCounter = useRef(0);

  // Arrangement state
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const hasPausedRef = useRef(false);
  const initialGameBlocksRef = useRef<any[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Play state camera and trails
  const activeStrokesRef = useRef<TrailStroke[]>([]);
  const currentStrokeId = useRef<number | null>(null);
  const nextStrokeId = useRef(0);
  const intersectedBlocksRef = useRef<Set<string>>(new Set());
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  useEffect(() => {
     gameTimeRef.current = -2000;
     pendingEventsRef.current = [...gameEvents].sort((a, b) => a.time - b.time);
     activeCirclesRef.current = [];
     setActiveCirclesState([]);
     intersectedBlocksRef.current.clear();
     activeStrokesRef.current = [];
  }, [gameResetCount, gameEvents]);

  // Global pointer up and wheel zoom
  useEffect(() => {
    const handleGlobalUp = () => {
      setIsPanning(false);
      setDragBlockId(null);
      if (hasPausedRef.current) {
          useStore.temporal.getState().resume();
          hasPausedRef.current = false;
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);

    const wheelHandler = (e: WheelEvent) => {
      const state = useStore.getState();
      if (state.gameState !== 'arrange' && state.gameState !== 'play') return;
      e.preventDefault();
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
      
      const oldZoom = state.camera.zoom;
      let newZoom = oldZoom * direction;
      newZoom = Math.min(Math.max(newZoom, 0.1), 5);
      
      const globalX = state.gameState === 'play' ? window.innerWidth / 2 : e.clientX;
      const globalY = state.gameState === 'play' ? window.innerHeight / 2 : e.clientY;
      const localX = (globalX - state.camera.x) / oldZoom;
      const localY = (globalY - state.camera.y) / oldZoom;
      
      const newCameraX = globalX - localX * newZoom;
      const newCameraY = globalY - localY * newZoom;

      state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
    };
    document.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      document.removeEventListener('wheel', wheelHandler);
    };
  }, []);


  // Handle Play mode camera and hit logic
  useEffect(() => {
    if (gameState !== 'play') return;
    
    document.body.requestPointerLock().catch(err => {
      console.error("Pointer lock failed", err);
    });

    let rafId: number | null = null;
    let pendingMovementX = 0;
    let pendingMovementY = 0;
    let buttonsPressed = 0;

    const handleMouseMove = (e: MouseEvent) => {
      pendingMovementX += e.movementX;
      pendingMovementY += e.movementY;
      buttonsPressed = e.buttons;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          const state = useStore.getState();
          const newCamX = state.camera.x - pendingMovementX * state.mouseSensitivity;
          const newCamY = state.camera.y - pendingMovementY * state.mouseSensitivity;
          
          if (buttonsPressed > 0) {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            const oldLocalX = (centerX - state.camera.x) / state.camera.zoom;
            const oldLocalY = (centerY - state.camera.y) / state.camera.zoom;
            
            const newLocalX = (centerX - newCamX) / state.camera.zoom;
            const newLocalY = (centerY - newCamY) / state.camera.zoom;
            
            if (currentStrokeId.current !== null) {
              const stroke = activeStrokesRef.current.find(s => s.id === currentStrokeId.current);
              if (stroke) {
                stroke.points.push({ x: newLocalX, y: newLocalY, time: Date.now() });
              }
            }
            
            checkTrailIntersection(oldLocalX, oldLocalY, newLocalX, newLocalY);
          }
          
          useStore.getState().updateCamera({ x: newCamX, y: newCamY });
          
          pendingMovementX = 0;
          pendingMovementY = 0;
          buttonsPressed = 0;
          rafId = null;
        });
      }
    };

    const handleMouseDown = () => {
      const state = useStore.getState();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const localX = (centerX - state.camera.x) / state.camera.zoom;
      const localY = (centerY - state.camera.y) / state.camera.zoom;
      
      const id = nextStrokeId.current++;
      currentStrokeId.current = id;
      activeStrokesRef.current.push({
        id,
        points: [{ x: localX, y: localY, time: Date.now() }]
      });
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(localX, localY, localX, localY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.buttons === 0) {
        intersectedBlocksRef.current.clear();
        currentStrokeId.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };
  }, [gameState]);

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

  const attemptHit = (blockId: string) => {
      const b = gameBlocks.find(blk => blk.id === blockId);
      if (b) {
          playNote(b.pitch, b.volume, b.instrument);
          updateGameBlock(b.id, { playedAt: Date.now() });
      }

      if (useStore.getState().gameState !== 'play') return;

      const elapsedTime = gameTimeRef.current;
      
      let bestHitIndex = -1;
      let minTimeDiff = Infinity;

      for (let i = 0; i < activeCirclesRef.current.length; i++) {
          const circle = activeCirclesRef.current[i];
          if (circle.blockId === blockId) {
             const timeDiff = Math.abs(elapsedTime - circle.eventTime);
             if (timeDiff < HIT_WINDOW && timeDiff < minTimeDiff) {
                 minTimeDiff = timeDiff;
                 bestHitIndex = i;
             }
          }
      }

      const hitCircle = bestHitIndex !== -1 ? activeCirclesRef.current[bestHitIndex] : null;

      if (hitCircle) {
          const offset = elapsedTime - hitCircle.eventTime;
          activeCirclesRef.current.splice(bestHitIndex, 1);
          
          let points = 50;
          let type: 'Perfect' | 'Good' | 'Bad' = 'Bad';
          if (minTimeDiff < 50) { points = 300; type = 'Perfect'; }
          else if (minTimeDiff < 100) { points = 100; type = 'Good'; }
          
          setGameStats({ 
              gameScore: useStore.getState().gameScore + points, 
              gameCombo: useStore.getState().gameCombo + 1,
              latestHit: { type, offset, time: Date.now(), color: hitCircle.color }
          });
          setActiveCirclesState([...activeCirclesRef.current]);
      } else {
          // Break combo for hitting wrong block or too early? Osu usually doesn't break on empty hits, but let's leave it.
      }
  };

  const checkTrailIntersection = (x1: number, y1: number, x2: number, y2: number) => {
    const currentFrameIntersected = new Set<string>();
    const state = useStore.getState();
    state.gameBlocks.forEach(b => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
           attemptHit(b.id);
        }
      }
    });
    intersectedBlocksRef.current = currentFrameIntersected;
  };

  const handleTick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTickTimeRef.current;
    lastTickTimeRef.current = now;

    if (gameState !== 'play') return;
    
    gameTimeRef.current += delta;
    const elapsedTime = gameTimeRef.current;

    while (pendingEventsRef.current.length > 0) {
      const nextEvent = pendingEventsRef.current[0];
      if (elapsedTime >= nextEvent.time - APPROACH_TIME) {
        pendingEventsRef.current.shift();
        const b = gameBlocks.find(blk => blk.id === nextEvent.blockId);
        if (b) {
           activeCirclesRef.current.push({
               id: Math.random().toString(),
               eventTime: nextEvent.time,
               x: b.x,
               y: b.y,
               color: getPitchColorNumber(b.pitch, 36),
               progress: 0,
               blockId: b.id,
               pitch: b.pitch,
               instrument: b.instrument ?? 'piano'
           });
        }
      } else {
        break;
      }
    }

    let stateChanged = false;
    for (let i = activeCirclesRef.current.length - 1; i >= 0; i--) {
       const circle = activeCirclesRef.current[i];
       const timeAlive = elapsedTime - (circle.eventTime - APPROACH_TIME);
       circle.progress = timeAlive / APPROACH_TIME;

       if (elapsedTime > circle.eventTime + HIT_WINDOW) {
           activeCirclesRef.current.splice(i, 1);
           setGameStats({ 
             gameCombo: 0,
             latestHit: { type: 'Miss', offset: HIT_WINDOW, time: Date.now(), color: circle.color }
           }); // Break combo
           stateChanged = true;
       }
    }

    tickCounter.current++;
    if (tickCounter.current % 2 === 0 || stateChanged) {
        setActiveCirclesState([...activeCirclesRef.current]);
    }

  }, [gameState, gameBlocks]);

  const TickerSync = () => {
      useTick(handleTick);
      return null;
  };

  // Arrangement Phase Handlers
  const handlePointerDown = (e: any) => {
      if (gameState !== 'arrange') return;
      if (e.button === 1) { // Middle click
        setIsPanning(true);
        const pos = e.global;
        setPanStart({ x: pos.x - useStore.getState().camera.x, y: pos.y - useStore.getState().camera.y });
      } else if (e.button === 2) { // Right click
        const id = nextStrokeId.current++;
        currentStrokeId.current = id;
        activeStrokesRef.current.push({
          id,
          points: [{ x: e.global.x, y: e.global.y, time: Date.now() }] // Global is fine for visual if we aren't panning, but trails expect local
        });
        intersectedBlocksRef.current.clear();
        
        const state = useStore.getState();
        const localX = (e.global.x - state.camera.x) / state.camera.zoom;
        const localY = (e.global.y - state.camera.y) / state.camera.zoom;
        
        // Fix points to local
        activeStrokesRef.current[activeStrokesRef.current.length - 1].points[0] = { x: localX, y: localY, time: Date.now() };

        checkTrailIntersection(localX, localY, localX, localY);
      }
  };

  const handleBlockPointerDown = (e: any, id: string, x: number, y: number) => {
      if (gameState !== 'arrange') return;
      if (e.button === 1 || e.button === 2) return; // Ignore middle and right click on blocks for dragging
      setDragBlockId(id);
      const pos = e.currentTarget.parent.toLocal(e.global);
      setDragOffset({ x: pos.x - x, y: pos.y - y });
      
      hasPausedRef.current = false;
      initialGameBlocksRef.current = useStore.getState().gameBlocks;
      
      if (e.target && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: any) => {
      if (gameState === 'arrange' && dragBlockId) {
          const pos = e.currentTarget.toLocal(e.global);
          let newX = pos.x - dragOffset.x;
          let newY = pos.y - dragOffset.y;
          
          const snapSize = useStore.getState().snapToGrid ? 20 : 1;
          newX = Math.round(newX / snapSize) * snapSize;
          newY = Math.round(newY / snapSize) * snapSize;

          if (!hasPausedRef.current) {
              const state = useStore.getState();
              useStore.temporal.setState(s => ({
                  pastStates: [...s.pastStates, { 
                      blocks: state.blocks, 
                      groups: state.groups, 
                      groupRects: state.groupRects, 
                      tracks: state.tracks, 
                      gameBlocks: state.gameBlocks 
                  }],
                  futureStates: []
              }));
              useStore.temporal.getState().pause();
              hasPausedRef.current = true;
          }

          useStore.getState().updateGameBlock(dragBlockId, { x: newX, y: newY });
      } else if (gameState === 'arrange' && e.buttons === 2) {
          const state = useStore.getState();
          const localX = (e.global.x - state.camera.x) / state.camera.zoom;
          const localY = (e.global.y - state.camera.y) / state.camera.zoom;
          
          if (currentStrokeId.current !== null) {
              const stroke = activeStrokesRef.current.find(s => s.id === currentStrokeId.current);
              if (stroke && stroke.points.length > 0) {
                  const prev = stroke.points[stroke.points.length - 1];
                  stroke.points.push({ x: localX, y: localY, time: Date.now() });
                  checkTrailIntersection(prev.x, prev.y, localX, localY);
              }
          }
      } else if (gameState === 'arrange' && isPanning) {
          const pos = e.global;
          useStore.getState().updateCamera({
             x: pos.x - panStart.x,
             y: pos.y - panStart.y,
          });
      }
  };

  const handlePointerUp = () => {
      setDragBlockId(null);
      setIsPanning(false);
      currentStrokeId.current = null;
      intersectedBlocksRef.current.clear();
      if (hasPausedRef.current) {
          useStore.temporal.getState().resume();
          hasPausedRef.current = false;
      }
  };

  const drawGrid = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.rect(-10000, -10000, 20000, 20000); 
    g.fill({ color: 0x000000, alpha: 0.001 }); 

    if (!showGrid) return;

    const isDark = theme === 'dark';
    const gridColor = isDark ? 0xffffff : 0x000000;
    const gridAlpha = isDark ? 0.05 : 0.02; 
    
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
  }, [theme, showGrid]);

  return (
    <Application backgroundAlpha={0} resizeTo={window} antialias={true}>
      <TickerSync />
      <pixiContainer
        x={camera.x}
        y={camera.y}
        scale={camera.zoom}
        eventMode="static"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerUpOutside={handlePointerUp}
      >
        <pixiGraphics draw={drawGrid} eventMode="static" />
        
        {/* Draw Blocks */}
        {gameBlocks.map(b => {
            const blockColor = getPitchColorNumber(b.pitch, 36);
            return (
              <BaseBlock 
                 key={b.id}
                 id={b.id}
                 x={b.x}
                 y={b.y}
                 pitch={b.pitch}
                 instrument={b.instrument ?? 'piano'}
                 volume={b.volume ?? 1}
                 blockColor={blockColor} 
                 onPointerDown={(e) => handleBlockPointerDown(e, b.id, b.x, b.y)}
                 isInteractive={gameState === 'arrange'}
                 showPitch={showBlockPitch}
                 showInstrument={showBlockInstrument}
                 showVolume={showBlockVolume}
                 opacity={blockOpacity}
                 playedAt={b.playedAt}
              />
            );
        })}

        {/* Draw Approach Circles */}
        {gameState === 'play' && activeCirclesState.map(circle => (
           <ApproachCircleComponent 
              key={circle.id} 
              x={circle.x} 
              y={circle.y} 
              progress={circle.progress}
              color={circle.color}
           />
        ))}

        {(gameState === 'play' || gameState === 'arrange') && (
           <TrailRenderer activeStrokesRef={activeStrokesRef} currentStrokeId={currentStrokeId} />
        )}
      </pixiContainer>
    </Application>
  );
};


