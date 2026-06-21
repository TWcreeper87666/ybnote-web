import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { getPitchColorNumber } from '../../utils/colors';
import { playNote } from '../../utils/audio';
import { NoteBlock } from '../blocks/NoteBlock';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  const { gameBlocks, gameEvents, camera, theme, gameState, updateGameBlock, setGameStats, gameResetCount, showGrid } = useStore();
  const isMobile = useIsMobile();
  
  const gameTimeRef = useRef(-2000);
  const lastTickTimeRef = useRef(Date.now());
  const pendingEventsRef = useRef([...gameEvents].sort((a, b) => a.time - b.time));
  const activeCirclesRef = useRef<{ id: string, eventTime: number, x: number, y: number, color: number, progress: number, blockId: string, pitch: string, instrument: string }[]>([]);
  const [activeCirclesState, setActiveCirclesState] = useState(activeCirclesRef.current);
  const tickCounter = useRef(0);

  // Arrangement state
  const hasPausedRef = useRef(false);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const selectionStartRef = useRef<{x: number, y: number} | null>(null);
  const isMobileRightClickRef = useRef(false);

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
      isPanningRef.current = false;
      selectionStartRef.current = null;
      setSelectionBox(null);
      if (hasPausedRef.current) {
          useStore.temporal.getState().resume();
          hasPausedRef.current = false;
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);

    const wheelHandler = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      const state = useStore.getState();
      if (state.gameState !== 'arrange' && state.gameState !== 'play') return;
      e.preventDefault();
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
      
      const oldZoom = state.camera.zoom;
      let newZoom = oldZoom * direction;
      newZoom = Math.min(Math.max(newZoom, 0.1), 5);
      
      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const globalX = state.gameState === 'play' ? window.innerWidth / 2 : e.clientX - rect.left;
      const globalY = state.gameState === 'play' ? window.innerHeight / 2 : e.clientY - rect.top;
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
    
    if (!isMobile) {
      document.body.requestPointerLock().catch(err => {
        console.error("Pointer lock failed", err);
      });
    }

    let rafId: number | null = null;
    let pendingMovementX = 0;
    let pendingMovementY = 0;
    let buttonsPressed = 0;

    let leftTouchId: number | null = null;
    let rightTouchId: number | null = null;
    let lastRightTouchPos: { x: number, y: number } | null = null;
    let playPinchDist = 0;
    let playInitZoom = 1;
    let playInitLocalX = 0;
    let playInitLocalY = 0;

    const applyMovement = () => {
      const state = useStore.getState();
      const newCamX = state.camera.x - pendingMovementX * (isMobile ? state.mouseSensitivity * 2 : state.mouseSensitivity);
      const newCamY = state.camera.y - pendingMovementY * (isMobile ? state.mouseSensitivity * 2 : state.mouseSensitivity);
      
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
      if (!isMobile) buttonsPressed = 0; // Mouse resets per move event if dragging, but actually let's keep buttonsPressed handled by mouseup/down
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      pendingMovementX += e.movementX;
      pendingMovementY += e.movementY;
      buttonsPressed = e.buttons;

      if (!rafId) {
        rafId = requestAnimationFrame(applyMovement);
      }
    };

    const handleMouseDown = () => {
      const state = useStore.getState();
      const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
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

    const handleTouchStart = (e: TouchEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < window.innerWidth / 2) {
          if (leftTouchId === null) {
            leftTouchId = touch.identifier;
            buttonsPressed = 1;
            handleMouseDown();
          }
        } else {
          if (rightTouchId === null) {
            rightTouchId = touch.identifier;
            lastRightTouchPos = { x: touch.clientX, y: touch.clientY };
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      e.preventDefault();

      let rightTouches = [];
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX >= window.innerWidth / 2) {
          rightTouches.push(e.touches[i]);
        }
      }

      if (rightTouches.length === 2) {
        const dist = Math.sqrt(Math.pow(rightTouches[0].clientX - rightTouches[1].clientX, 2) + Math.pow(rightTouches[0].clientY - rightTouches[1].clientY, 2));
        if (playPinchDist === 0) {
          playPinchDist = dist;
          playInitZoom = useStore.getState().camera.zoom;
          const centerX = (rightTouches[0].clientX + rightTouches[1].clientX) / 2;
          const centerY = (rightTouches[0].clientY + rightTouches[1].clientY) / 2;
          const state = useStore.getState();
          playInitLocalX = (centerX - state.camera.x) / state.camera.zoom;
          playInitLocalY = (centerY - state.camera.y) / state.camera.zoom;
        } else {
          const state = useStore.getState();
          const zoomFactor = dist / playPinchDist;
          let newZoom = playInitZoom * zoomFactor;
          newZoom = Math.min(Math.max(newZoom, 0.1), 5);
          
          const centerX = (rightTouches[0].clientX + rightTouches[1].clientX) / 2;
          const centerY = (rightTouches[0].clientY + rightTouches[1].clientY) / 2;
          
          const newCameraX = centerX - playInitLocalX * newZoom;
          const newCameraY = centerY - playInitLocalY * newZoom;
          
          state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
        }
        lastRightTouchPos = null; // Prevent jump after pinch
        return;
      } else {
        playPinchDist = 0;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === rightTouchId && lastRightTouchPos) {
          pendingMovementX += (touch.clientX - lastRightTouchPos.x);
          pendingMovementY += (touch.clientY - lastRightTouchPos.y);
          lastRightTouchPos = { x: touch.clientX, y: touch.clientY };
          
          if (!rafId) {
             rafId = requestAnimationFrame(applyMovement);
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      e.preventDefault();
      
      let rightTouchesCount = 0;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX >= window.innerWidth / 2) rightTouchesCount++;
      }
      if (rightTouchesCount < 2) playPinchDist = 0;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === leftTouchId) {
          leftTouchId = null;
          buttonsPressed = 0;
          intersectedBlocksRef.current.clear();
          currentStrokeId.current = null;
        } else if (touch.identifier === rightTouchId) {
          rightTouchId = null;
          lastRightTouchPos = null;
        }
      }
    };

    if (isMobile) {
      window.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd, { passive: false });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    } else {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (isMobile) {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
      } else {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
    };
  }, [gameState, isMobile]);

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
          
          const state = useStore.getState();
          const newCombo = state.gameCombo + 1;
          const newStats: any = { 
              gameScore: state.gameScore + points, 
              gameCombo: newCombo,
              maxCombo: Math.max(state.maxCombo, newCombo),
              latestHit: { type, offset, time: Date.now(), color: hitCircle.color }
          };
          if (type === 'Perfect') newStats.perfectCount = state.perfectCount + 1;
          else if (type === 'Good') newStats.goodCount = state.goodCount + 1;
          else if (type === 'Bad') newStats.badCount = state.badCount + 1;
          
          setGameStats(newStats);
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
           const state = useStore.getState();
           setGameStats({ 
             gameCombo: 0,
             missCount: state.missCount + 1,
             latestHit: { type: 'Miss', offset: HIT_WINDOW, time: Date.now(), color: circle.color }
           }); // Break combo
           stateChanged = true;
       }
    }

    if (pendingEventsRef.current.length === 0 && activeCirclesRef.current.length === 0) {
        const lastEventTime = gameEvents.length > 0 ? gameEvents[gameEvents.length - 1].time : 0;
        if (elapsedTime > lastEventTime + HIT_WINDOW + 1500) {
            useStore.getState().setGameState('result');
            return;
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

  // Pinch Zoom for Arrange Mode
  useEffect(() => {
    if (!isMobile) return;
    
    let initialPinchDist = 0;
    let initialZoom = 1;
    let initialLocalX = 0;
    let initialLocalY = 0;
    
    let longPressTimer: any;
    let startX = 0; let startY = 0;

    const trackTouches = (e: TouchEvent) => { 
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      (window as any).__activeTouches = e.touches.length; 
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      
      if (e.type === 'touchstart') {
          if (e.touches.length === 1) {
              startX = e.touches[0].clientX;
              startY = e.touches[0].clientY;
              longPressTimer = setTimeout(() => {
                  if ((window as any).__activeTouches === 1) {
                      window.dispatchEvent(new CustomEvent('mobile-long-press', { detail: { x: startX, y: startY } }));
                  }
              }, 500);

              if (useStore.getState().gameState === 'arrange') {
                 const state = useStore.getState();
                 let canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
                 const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
                 const localX = (startX - rect.left - state.camera.x) / state.camera.zoom;
                 const localY = (startY - rect.top - state.camera.y) / state.camera.zoom;
                 const hitBlock = state.gameBlocks.find(b => localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60);
                 if (!hitBlock) {
                     (window as any).__panStart = { x: startX - state.camera.x, y: startY - state.camera.y };
                 } else {
                     (window as any).__panStart = null;
                 }
              }
          } else {
              clearTimeout(longPressTimer);
          }
          
          if (e.touches.length >= 2 && useStore.getState().gameState === 'arrange') {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              initialPinchDist = Math.sqrt(dx*dx + dy*dy);
              const state = useStore.getState();
              initialZoom = state.camera.zoom;
              const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
              initialLocalX = (centerX - rect.left - state.camera.x) / state.camera.zoom;
              initialLocalY = (centerY - rect.top - state.camera.y) / state.camera.zoom;
          }
      } else if (e.type === 'touchmove') {
          if (isCanvas && e.cancelable) e.preventDefault(); // Prevents browser scrolling, guarantees continuous events!

          if (e.touches.length === 1 && Math.hypot(e.touches[0].clientX - startX, e.touches[0].clientY - startY) > 10) {
              clearTimeout(longPressTimer);
          }

          const state = useStore.getState();
          if (e.touches.length === 1 && state.gameState === 'arrange') {
              if (isMobileRightClickRef.current) {
                  let canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
                  const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
                  const localX = (e.touches[0].clientX - rect.left - state.camera.x) / state.camera.zoom;
                  const localY = (e.touches[0].clientY - rect.top - state.camera.y) / state.camera.zoom;
                  
                  if (currentStrokeId.current !== null) {
                      const stroke = activeStrokesRef.current.find(s => s.id === currentStrokeId.current);
                      if (stroke && stroke.points.length > 0) {
                          const prev = stroke.points[stroke.points.length - 1];
                          if (Math.hypot(localX - prev.x, localY - prev.y) > 2) {
                              stroke.points.push({ x: localX, y: localY, time: Date.now() });
                              checkTrailIntersection(prev.x, prev.y, localX, localY);
                          }
                      }
                  }
              } else if ((window as any).__panStart && Math.hypot(e.touches[0].clientX - startX, e.touches[0].clientY - startY) > 5) {
                  useStore.getState().updateCamera({
                     x: e.touches[0].clientX - (window as any).__panStart.x,
                     y: e.touches[0].clientY - (window as any).__panStart.y
                  });
              }
          }
          
          if (e.touches.length >= 2 && initialPinchDist > 0 && useStore.getState().gameState === 'arrange') {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const zoomFactor = dist / initialPinchDist;
              let newZoom = initialZoom * zoomFactor;
              newZoom = Math.min(Math.max(newZoom, 0.1), 5);
              const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
              const newCameraX = (currentCenterX - rect.left) - initialLocalX * newZoom;
              const newCameraY = (currentCenterY - rect.top) - initialLocalY * newZoom;
              useStore.getState().updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
          }
      } else {
          clearTimeout(longPressTimer);
          if (e.touches.length === 1) {
              // User lifted a finger from a pinch, re-initialize panning for the remaining finger
              startX = e.touches[0].clientX;
              startY = e.touches[0].clientY;
              if (useStore.getState().gameState === 'arrange') {
                 const state = useStore.getState();
                 (window as any).__panStart = { x: startX - state.camera.x, y: startY - state.camera.y };
              }
          }
          if (e.touches.length < 2) initialPinchDist = 0;
          if (e.touches.length === 0) {
              (window as any).__panStart = null;
              if (isMobileRightClickRef.current) {
                  isMobileRightClickRef.current = false;
                  currentStrokeId.current = null;
                  intersectedBlocksRef.current.clear();
              }
          }
      }
    };
    
    window.addEventListener('touchstart', trackTouches, { passive: false });
    window.addEventListener('touchmove', trackTouches, { passive: false });
    window.addEventListener('touchend', trackTouches);
    window.addEventListener('touchcancel', trackTouches);

    const handleTouchStart = (e: TouchEvent) => {
      if (useStore.getState().gameState !== 'arrange') return;
      if (e.touches.length >= 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.sqrt(dx*dx + dy*dy);
        const state = useStore.getState();
        initialZoom = state.camera.zoom;
        
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        let canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        
        initialLocalX = (centerX - rect.left - state.camera.x) / state.camera.zoom;
        initialLocalY = (centerY - rect.top - state.camera.y) / state.camera.zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = useStore.getState();
      if (state.gameState !== 'arrange') return;
      
      if (e.touches.length >= 2 && initialPinchDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const zoomFactor = dist / initialPinchDist;
        let newZoom = initialZoom * zoomFactor;
        newZoom = Math.min(Math.max(newZoom, 0.1), 5);
        
        const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        let canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        
        const newCameraX = (currentCenterX - rect.left) - initialLocalX * newZoom;
        const newCameraY = (currentCenterY - rect.top) - initialLocalY * newZoom;
        
        state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDist = 0;
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
       window.removeEventListener('touchstart', trackTouches);
       window.removeEventListener('touchmove', trackTouches);
       window.removeEventListener('touchend', trackTouches);
       window.removeEventListener('touchcancel', trackTouches);
       window.removeEventListener('touchstart', handleTouchStart);
       window.removeEventListener('touchmove', handleTouchMove);
       window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile]);

  // Long Press Right Click Mode Listener
  useEffect(() => {
    if (!isMobile) return;
    const onLongPress = (e: any) => {
         if (useStore.getState().gameState !== 'arrange') return;
         isMobileRightClickRef.current = true;
         isPanningRef.current = false;
         useStore.getState().clearSelection();
         
         let canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('canvas');
         const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
         const state = useStore.getState();
         
         const localX = (e.detail.x - rect.left - state.camera.x) / state.camera.zoom;
         const localY = (e.detail.y - rect.top - state.camera.y) / state.camera.zoom;
         
         const id = nextStrokeId.current++;
         currentStrokeId.current = id;
         activeStrokesRef.current.push({
             id,
             points: [{ x: localX, y: localY, time: Date.now() }]
         });
         intersectedBlocksRef.current.clear();
         
         checkTrailIntersection(localX, localY, localX, localY);
    };
    window.addEventListener('mobile-long-press', onLongPress as EventListener);
    return () => window.removeEventListener('mobile-long-press', onLongPress as EventListener);
  }, [isMobile]);

  // Arrangement Phase Handlers
  const handlePointerDown = (e: any) => {
      if (gameState !== 'arrange') return;
      if (e.button === 1) { // Middle click
        isPanningRef.current = true;
        const pos = e.global;
        panStartRef.current = { x: pos.x - useStore.getState().camera.x, y: pos.y - useStore.getState().camera.y };
      } else if (e.button === 0 && e.target && e.target.label === 'background') { // Left click
        useStore.getState().closeContextMenu();
        if (isMobile) {
          isPanningRef.current = true;
          const pos = e.global;
          panStartRef.current = { x: pos.x - useStore.getState().camera.x, y: pos.y - useStore.getState().camera.y };
        } else {
          if (!e.ctrlKey && !e.shiftKey) {
            useStore.getState().clearSelection();
          }
          const pos = e.currentTarget.toLocal(e.global);
          selectionStartRef.current = { x: pos.x, y: pos.y };
          setSelectionBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
          if (e.pointerId !== undefined && e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
          }
        }
      } else if (e.button === 2) { // Right click
        const id = nextStrokeId.current++;
        currentStrokeId.current = id;
        activeStrokesRef.current.push({
          id,
          points: [{ x: e.global.x, y: e.global.y, time: Date.now() }] 
        });
        intersectedBlocksRef.current.clear();
        
        const state = useStore.getState();
        const localX = (e.global.x - state.camera.x) / state.camera.zoom;
        const localY = (e.global.y - state.camera.y) / state.camera.zoom;
        
        activeStrokesRef.current[activeStrokesRef.current.length - 1].points[0] = { x: localX, y: localY, time: Date.now() };

        checkTrailIntersection(localX, localY, localX, localY);
      }
  };

  const handlePointerMove = (e: any) => {
      if (gameState === 'arrange' && selectionStartRef.current) {
          const pos = e.currentTarget.toLocal(e.global);
          const start = selectionStartRef.current;
          const x = Math.min(start.x, pos.x);
          const y = Math.min(start.y, pos.y);
          const w = Math.abs(pos.x - start.x);
          const h = Math.abs(pos.y - start.y);
          setSelectionBox({ x, y, w, h });
          
          const state = useStore.getState();
          const directlySelectedGameBlocks = state.gameBlocks.filter(b => {
            return b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y;
          });
          
          useStore.setState({ selectedBlockIds: directlySelectedGameBlocks.map(b => b.id) });
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
      } else if (gameState === 'arrange' && isPanningRef.current) {
          if (isMobile) return; // Handled natively in trackTouches
          const pos = e.global;
          useStore.getState().updateCamera({
             x: pos.x - panStartRef.current.x,
             y: pos.y - panStartRef.current.y,
          });
      }
  };

  const handlePointerUp = (e: any) => {
      selectionStartRef.current = null;
      setSelectionBox(null);
      isPanningRef.current = false;
      isMobileRightClickRef.current = false;
      currentStrokeId.current = null;
      intersectedBlocksRef.current.clear();
      if (hasPausedRef.current) {
          useStore.temporal.getState().resume();
          hasPausedRef.current = false;
      }
      if (e.pointerId !== undefined && e.target && e.target.releasePointerCapture) {
        try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
      }
  };

  const drawSelectionBox = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (selectionBox) {
      g.rect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      g.fill({ color: 0x6366f1, alpha: 0.2 });
      g.stroke({ width: 1 / camera.zoom, color: 0x6366f1, alpha: 0.8 });
    }
  }, [selectionBox, camera.zoom]);

  const drawGrid = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.rect(-10000, -10000, 20000, 20000); 
    g.fill({ color: 0x000000, alpha: 0.001 }); 

    if (!showGrid) return;

    const isDark = theme === 'dark';
    const gridColor = isDark ? 0xffffff : 0x000000;
    const gridAlpha = isDark ? 0.1 : 0.05; 
    
    const gridSize = 60;
    const size = 5000;
    const startPos = Math.floor(-size / gridSize) * gridSize;
    const endPos = Math.ceil(size / gridSize) * gridSize;
    
    // Optimizing grid display when zoomed out
    const step = camera.zoom < 0.3 ? gridSize * 4 : (camera.zoom < 0.6 ? gridSize * 2 : gridSize);
    
    for (let x = startPos; x <= endPos; x += step) {
      g.moveTo(x, startPos);
      g.lineTo(x, endPos);
    }
    for (let y = startPos; y <= endPos; y += step) {
      g.moveTo(startPos, y);
      g.lineTo(endPos, y);
    }
    g.stroke({ width: 1 / camera.zoom, color: gridColor, alpha: gridAlpha });
  }, [theme, showGrid, camera.zoom]);

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
        <pixiGraphics label="background" draw={drawGrid} eventMode="static" />
        <pixiGraphics zIndex={200} draw={drawSelectionBox} eventMode="none" />
        
        {/* Draw Blocks */}
        {gameBlocks.map(b => (
          <NoteBlock 
             key={b.id}
             id={b.id}
             x={b.x}
             y={b.y}
             pitch={b.pitch}
          />
        ))}

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


