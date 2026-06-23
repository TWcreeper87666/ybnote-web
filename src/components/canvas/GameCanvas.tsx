import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { getPitchColorNumber } from '../../utils/colors';
import { playNote } from '../../utils/audio';
import { NoteBlock } from '../blocks/NoteBlock';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TrailRenderer } from './shared/TrailRenderer';
import { GridBackground } from './shared/GridBackground';
import { SelectionBoxRenderer } from './shared/SelectionBoxRenderer';
import { GroupRectRenderer } from '../containers/GroupRectRenderer';
import { useCanvasCamera } from '../../hooks/useCanvasCamera';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { lineIntersectsRect } from '../../utils/geometry';

declare global {
  interface Window {
    __currentGameTime?: number;
    __activeTouches?: number;
    __panStart?: { x: number; y: number } | null;
  }
}

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

const TickerSync: React.FC<{ handleTick: () => void }> = ({ handleTick }) => {
    useTick(handleTick);
    return null;
};

export const GameCanvas: React.FC = () => {
  const { gameBlocks, gameEvents, gameCamera: camera, theme, gameState, setGameStats, gameResetCount, showGrid } = useStore();
  const isMobile = useIsMobile();
  
  const gameTimeRef = useRef(-APPROACH_TIME);
  // eslint-disable-next-line react-hooks/purity
  const lastTickTimeRef = useRef(Date.now());
  const pendingCirclesRef = useRef(gameEvents.filter(e => e.blockId !== 'background').sort((a, b) => a.time - b.time));
  const pendingBgAudioRef = useRef(gameEvents.filter(e => e.blockId === 'background').sort((a, b) => a.time - b.time));
  const activeCirclesRef = useRef<{ id: string, eventTime: number, x: number, y: number, color: number, progress: number, blockId: string, pitch: string, instrument: string }[]>([]);
  const [activeCirclesState, setActiveCirclesState] = useState<{ id: string, eventTime: number, x: number, y: number, color: number, progress: number, blockId: string, pitch: string, instrument: string }[]>([]);
  const tickCounter = useRef(0);

  // Arrangement state
  const hasPausedRef = useRef(false);

  const {
    isPanningRef, startPan, updatePan, endPan,
    selectionBox, startSelection, updateSelection, endSelection,
    activeStrokesRef, currentStrokeId, startTrail, updateTrail, endTrail,
    intersectedBlocksRef, isSelectingRef
  } = useCanvasInteractions();

  const isMobileRightClickRef = useRef(false);
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  useEffect(() => {
     gameTimeRef.current = -APPROACH_TIME;
     pendingCirclesRef.current = gameEvents.filter(e => e.blockId !== 'background').sort((a, b) => a.time - b.time);
     pendingBgAudioRef.current = gameEvents.filter(e => e.blockId === 'background').sort((a, b) => a.time - b.time);
     activeCirclesRef.current = [];
     // eslint-disable-next-line react-hooks/set-state-in-effect
     setActiveCirclesState([]);
     intersectedBlocksRef.current.clear();
     activeStrokesRef.current = [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameResetCount, gameEvents]);

  // Global pointer up and wheel zoom
  useEffect(() => {
    const handleGlobalUp = () => {
      if (hasPausedRef.current) {
          useStore.temporal.getState().resume();
          hasPausedRef.current = false;
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, []);

  useCanvasCamera({
    isPlayMode: gameState === 'play',
    isActive: gameState === 'arrange' || gameState === 'play',
    isGameCanvas: true,
    onWheelIntercept: (e) => {
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return true;
      return false;
    }
  });




  const attemptHit = useCallback((blockId: string) => {
      const state = useStore.getState();
      const b = state.gameBlocks.find(blk => blk.id === blockId);
      if (b) {
          playNote(b.pitch, b.volume, b.instrument);
          state.updateGameBlock(b.id, { playedAt: Date.now() });
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
          const newStats: Partial<ReturnType<typeof useStore.getState>> = { 
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
          const state = useStore.getState();
          const newScore = Math.max(0, state.gameScore - 50);
          setGameStats({
              gameScore: newScore,
              gameCombo: 0,
              wrongCount: state.wrongCount + 1,
              latestHit: { type: 'Wrong', offset: 0, time: Date.now(), color: b?.pitch ? getPitchColorNumber(b.pitch, 36) : 0xffffff }
          });
      }
  }, [setGameStats]);

  const checkTrailIntersection = useCallback((x1: number, y1: number, x2: number, y2: number) => {
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
  }, [attemptHit, intersectedBlocksRef]);

  // Handle Play mode camera and hit logic
  useEffect(() => {
    if (gameState !== 'play') return;
    
    const state = useStore.getState();
    const currentMode = state.mobileControlMode;

    if (!isMobile && currentMode === 'crosshair') {
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
      const newCamX = state.gameCamera.x - pendingMovementX * (isMobile ? state.mouseSensitivity * 2 : state.mouseSensitivity);
      const newCamY = state.gameCamera.y - pendingMovementY * (isMobile ? state.mouseSensitivity * 2 : state.mouseSensitivity);
      
      if (buttonsPressed > 0 && state.mobileControlMode === 'crosshair') {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        const newLocalX = (centerX - newCamX) / state.gameCamera.zoom;
        const newLocalY = (centerY - newCamY) / state.gameCamera.zoom;
        
        updateTrail(newLocalX, newLocalY, (p1, p2) => {
          checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
        });
      }
      
      useStore.getState().updateGameCamera({ x: newCamX, y: newCamY });
      
      pendingMovementX = 0;
      pendingMovementY = 0;
      if (!isMobile) buttonsPressed = 0;
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const state = useStore.getState();
      const mode = state.mobileControlMode;

      if (mode === 'crosshair') {
        pendingMovementX += e.movementX;
        pendingMovementY += e.movementY;
        buttonsPressed = e.buttons;

        if (!rafId) {
          rafId = requestAnimationFrame(applyMovement);
        }
      } else {
        if (e.buttons > 0) {
          const workspace = document.querySelector('.le-workspace');
          const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
          const localX = (e.clientX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
          const localY = (e.clientY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
          updateTrail(localX, localY, (p1, p2) => {
             checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
          });
        }
      }
    };

    const handleMouseDown = (e?: MouseEvent) => {
      const state = useStore.getState();
      const mode = state.mobileControlMode;
      const workspace = document.querySelector('.le-workspace');
      const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      
      let localX: number, localY: number;

      if (mode === 'crosshair') {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        localX = (centerX - state.gameCamera.x) / state.gameCamera.zoom;
        localY = (centerY - state.gameCamera.y) / state.gameCamera.zoom;
      } else if (e) {
        localX = (e.clientX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
        localY = (e.clientY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
      } else {
        return;
      }
      
      startTrail(localX, localY);
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(localX, localY, localX, localY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.buttons === 0) {
        intersectedBlocksRef.current.clear();
        endTrail();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      e.preventDefault();
      const state = useStore.getState();
      const mode = state.mobileControlMode;
      const workspace = document.querySelector('.le-workspace');
      const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (mode === 'crosshair') {
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
        } else {
           if ((e as unknown as TouchEvent).touches.length === 1) {
              if (leftTouchId === null) {
                leftTouchId = touch.identifier;
                const localX = (touch.clientX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
                const localY = (touch.clientY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
                startTrail(localX, localY);
                intersectedBlocksRef.current.clear();
                checkTrailIntersection(localX, localY, localX, localY);
              }
           } else if ((e as unknown as TouchEvent).touches.length >= 2) {
              if (leftTouchId !== null) {
                 endTrail();
                 leftTouchId = null;
              }
              const dx = (e as unknown as TouchEvent).touches[0].clientX - (e as unknown as TouchEvent).touches[1].clientX;
              const dy = (e as unknown as TouchEvent).touches[0].clientY - (e as unknown as TouchEvent).touches[1].clientY;
              playPinchDist = Math.sqrt(dx*dx + dy*dy);
              playInitZoom = state.gameCamera.zoom;
              const centerX = ((e as unknown as TouchEvent).touches[0].clientX + (e as unknown as TouchEvent).touches[1].clientX) / 2;
              const centerY = ((e as unknown as TouchEvent).touches[0].clientY + (e as unknown as TouchEvent).touches[1].clientY) / 2;
              playInitLocalX = (centerX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
              playInitLocalY = (centerY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
           }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      e.preventDefault();
      const state = useStore.getState();
      const mode = state.mobileControlMode;
      const workspace = document.querySelector('.le-workspace');
      const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };

      if (mode === 'crosshair') {
         const rightTouches = [];
         for (let i = 0; i < (e as unknown as TouchEvent).touches.length; i++) {
           if ((e as unknown as TouchEvent).touches[i].clientX >= window.innerWidth / 2) {
             rightTouches.push((e as unknown as TouchEvent).touches[i]);
           }
         }

         if (rightTouches.length >= 2) {
           const dist = Math.sqrt(Math.pow(rightTouches[0].clientX - rightTouches[1].clientX, 2) + Math.pow(rightTouches[0].clientY - rightTouches[1].clientY, 2));
           if (playPinchDist === 0) {
             playPinchDist = dist;
             playInitZoom = state.gameCamera.zoom;
             const centerX = (rightTouches[0].clientX + rightTouches[1].clientX) / 2;
             const centerY = (rightTouches[0].clientY + rightTouches[1].clientY) / 2;
             playInitLocalX = (centerX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
             playInitLocalY = (centerY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
           } else {
             const zoomFactor = dist / playPinchDist;
             let newZoom = playInitZoom * zoomFactor;
             newZoom = Math.min(Math.max(newZoom, 0.1), 5);
             const centerX = (rightTouches[0].clientX + rightTouches[1].clientX) / 2;
             const centerY = (rightTouches[0].clientY + rightTouches[1].clientY) / 2;
             const newCameraX = (centerX - rect.left) - playInitLocalX * newZoom;
             const newCameraY = (centerY - rect.top) - playInitLocalY * newZoom;
             state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
           }
           lastRightTouchPos = null;
         } else {
           playPinchDist = 0;
         }

         for (let i = 0; i < e.changedTouches.length; i++) {
           const touch = e.changedTouches[i];
           if (touch.identifier === rightTouchId && rightTouches.length < 2 && lastRightTouchPos) {
             pendingMovementX += (touch.clientX - lastRightTouchPos.x);
             pendingMovementY += (touch.clientY - lastRightTouchPos.y);
             lastRightTouchPos = { x: touch.clientX, y: touch.clientY };
             if (!rafId) rafId = requestAnimationFrame(applyMovement);
           }
         }
      } else {
         if ((e as unknown as TouchEvent).touches.length >= 2 && playPinchDist > 0) {
            const dx = (e as unknown as TouchEvent).touches[0].clientX - (e as unknown as TouchEvent).touches[1].clientX;
            const dy = (e as unknown as TouchEvent).touches[0].clientY - (e as unknown as TouchEvent).touches[1].clientY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const zoomFactor = dist / playPinchDist;
            let newZoom = playInitZoom * zoomFactor;
            newZoom = Math.min(Math.max(newZoom, 0.1), 5);
            
            const currentCenterX = ((e as unknown as TouchEvent).touches[0].clientX + (e as unknown as TouchEvent).touches[1].clientX) / 2;
            const currentCenterY = ((e as unknown as TouchEvent).touches[0].clientY + (e as unknown as TouchEvent).touches[1].clientY) / 2;
            
            const newCameraX = (currentCenterX - rect.left) - playInitLocalX * newZoom;
            const newCameraY = (currentCenterY - rect.top) - playInitLocalY * newZoom;
            state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
         } else if ((e as unknown as TouchEvent).touches.length === 1 && leftTouchId !== null) {
            for (let i = 0; i < e.changedTouches.length; i++) {
               const touch = e.changedTouches[i];
               if (touch.identifier === leftTouchId) {
                 const localX = (touch.clientX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
                 const localY = (touch.clientY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
                 updateTrail(localX, localY, (p1, p2) => {
                   checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
                 });
               }
            }
         }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      if (!isCanvas) return;
      e.preventDefault();
      const state = useStore.getState();
      const mode = state.mobileControlMode;

      if (mode === 'crosshair') {
         let rightTouchesCount = 0;
         for (let i = 0; i < (e as unknown as TouchEvent).touches.length; i++) {
           if ((e as unknown as TouchEvent).touches[i].clientX >= window.innerWidth / 2) rightTouchesCount++;
         }
         if (rightTouchesCount < 2) playPinchDist = 0;

         for (let i = 0; i < e.changedTouches.length; i++) {
           const touch = e.changedTouches[i];
           if (touch.identifier === leftTouchId) {
             leftTouchId = null;
             buttonsPressed = 0;
             intersectedBlocksRef.current.clear();
             endTrail();
           }
           if (touch.identifier === rightTouchId) {
             if (rightTouchesCount === 1) {
                const remainingRightTouch = Array.from((e as unknown as TouchEvent).touches).find((t: Touch) => t.clientX >= window.innerWidth / 2);
                if (remainingRightTouch) {
                   rightTouchId = (remainingRightTouch as unknown as Touch).identifier;
                   lastRightTouchPos = { x: (remainingRightTouch as unknown as Touch).clientX, y: (remainingRightTouch as unknown as Touch).clientY };
                } else {
                   rightTouchId = null;
                }
             } else {
                rightTouchId = null;
             }
           }
         }
      } else {
         if ((e as unknown as TouchEvent).touches.length < 2) playPinchDist = 0;
         for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === leftTouchId) {
               leftTouchId = null;
               intersectedBlocksRef.current.clear();
               endTrail();
            }
         }
         if ((e as unknown as TouchEvent).touches.length === 1 && playPinchDist === 0) {
            leftTouchId = (e as unknown as TouchEvent).touches[0].identifier;
            const workspace = document.querySelector('.le-workspace');
            const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
            const localX = ((e as unknown as TouchEvent).touches[0].clientX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
            const localY = ((e as unknown as TouchEvent).touches[0].clientY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
            startTrail(localX, localY);
            intersectedBlocksRef.current.clear();
            checkTrailIntersection(localX, localY, localX, localY);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, isMobile]);


  const handleTick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTickTimeRef.current;
    lastTickTimeRef.current = now;

    if (gameState !== 'play') return;
    
    const speed = useStore.getState().gameSpeed;
    gameTimeRef.current += delta * speed;
    const elapsedTime = gameTimeRef.current;
    window.__currentGameTime = elapsedTime;

    while (pendingCirclesRef.current.length > 0) {
      const nextEvent = pendingCirclesRef.current[0];
      if (elapsedTime >= nextEvent.time - APPROACH_TIME) {
        pendingCirclesRef.current.shift();
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

    while (pendingBgAudioRef.current.length > 0) {
      const nextEvent = pendingBgAudioRef.current[0];
      if (elapsedTime >= nextEvent.time) {
        pendingBgAudioRef.current.shift();
        playNote(nextEvent.pitch, 1, nextEvent.instrument);
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

    if (pendingCirclesRef.current.length === 0 && activeCirclesRef.current.length === 0) {
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameBlocks]);

  // Removed inline TickerSync

  // Pinch Zoom for Arrange Mode
  useEffect(() => {
    if (!isMobile) return;
    
    let initialPinchDist = 0;
    let initialZoom = 1;
    let initialLocalX = 0;
    let initialLocalY = 0;
    
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let startX = 0; let startY = 0;

    const trackTouches = (e: TouchEvent) => { 
      if ((e.target as HTMLElement)?.closest('.settings-panel, .tutorial-overlay')) return;
      window.__activeTouches = (e as unknown as TouchEvent).touches.length; 
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === 'canvas';
      
      if (e.type === 'touchstart') {
          if ((e as unknown as TouchEvent).touches.length === 1) {
              startX = (e as unknown as TouchEvent).touches[0].clientX;
              startY = (e as unknown as TouchEvent).touches[0].clientY;
              longPressTimer = setTimeout(() => {
                  if (window.__activeTouches === 1) {
                      window.dispatchEvent(new CustomEvent('mobile-long-press', { detail: { x: startX, y: startY } }));
                  }
              }, 500);

              if (useStore.getState().gameState === 'arrange') {
                 const state = useStore.getState();
                 const workspace = document.querySelector('.le-workspace');
                 const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
                 const localX = (startX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
                 const localY = (startY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
                 const hitBlock = state.gameBlocks.find(b => localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60);
                 if (!hitBlock) {
                     window.__panStart = { x: startX - state.gameCamera.x, y: startY - state.gameCamera.y };
                 } else {
                     window.__panStart = null;
                 }
              }
          } else {
              clearTimeout(longPressTimer);
          }
          
          if ((e as unknown as TouchEvent).touches.length >= 2 && useStore.getState().gameState === 'arrange') {
              const dx = (e as unknown as TouchEvent).touches[0].clientX - (e as unknown as TouchEvent).touches[1].clientX;
              const dy = (e as unknown as TouchEvent).touches[0].clientY - (e as unknown as TouchEvent).touches[1].clientY;
              initialPinchDist = Math.sqrt(dx*dx + dy*dy);
              const state = useStore.getState();
              initialZoom = state.gameCamera.zoom;
              const centerX = ((e as unknown as TouchEvent).touches[0].clientX + (e as unknown as TouchEvent).touches[1].clientX) / 2;
              const centerY = ((e as unknown as TouchEvent).touches[0].clientY + (e as unknown as TouchEvent).touches[1].clientY) / 2;
              const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
              initialLocalX = (centerX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
              initialLocalY = (centerY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
          }
      } else if (e.type === 'touchmove') {
          if (isCanvas && e.cancelable) e.preventDefault(); // Prevents browser scrolling, guarantees continuous events!

          if ((e as unknown as TouchEvent).touches.length === 1 && Math.hypot((e as unknown as TouchEvent).touches[0].clientX - startX, (e as unknown as TouchEvent).touches[0].clientY - startY) > 10) {
              clearTimeout(longPressTimer);
          }

          const state = useStore.getState();
          if ((e as unknown as TouchEvent).touches.length === 1 && state.gameState === 'arrange') {
              if (isMobileRightClickRef.current) {
                  const workspace = document.querySelector('.le-workspace');
                  const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
                  const localX = ((e as unknown as TouchEvent).touches[0].clientX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
                  const localY = ((e as unknown as TouchEvent).touches[0].clientY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
                  
                  updateTrail(localX, localY, (p1, p2) => {
                      checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
                  });
              } else if (window.__panStart && Math.hypot((e as unknown as TouchEvent).touches[0].clientX - startX, (e as unknown as TouchEvent).touches[0].clientY - startY) > 5) {

                useStore.getState().updateGameCamera({
                     x: (e as unknown as TouchEvent).touches[0].clientX - window.__panStart.x,
                     y: (e as unknown as TouchEvent).touches[0].clientY - window.__panStart.y
                  });
              }
          }
          
          if ((e as unknown as TouchEvent).touches.length >= 2 && initialPinchDist > 0 && useStore.getState().gameState === 'arrange') {
              const dx = (e as unknown as TouchEvent).touches[0].clientX - (e as unknown as TouchEvent).touches[1].clientX;
              const dy = (e as unknown as TouchEvent).touches[0].clientY - (e as unknown as TouchEvent).touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const zoomFactor = dist / initialPinchDist;
              let newZoom = initialZoom * zoomFactor;
              newZoom = Math.min(Math.max(newZoom, 0.1), 5);
              const currentCenterX = ((e as unknown as TouchEvent).touches[0].clientX + (e as unknown as TouchEvent).touches[1].clientX) / 2;
              const currentCenterY = ((e as unknown as TouchEvent).touches[0].clientY + (e as unknown as TouchEvent).touches[1].clientY) / 2;
              const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
              const newCameraX = (currentCenterX - rect.left) - initialLocalX * newZoom;
              const newCameraY = (currentCenterY - rect.top) - initialLocalY * newZoom;
              useStore.getState().updateGameCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
          }
      } else {
          clearTimeout(longPressTimer);
          if ((e as unknown as TouchEvent).touches.length === 1) {
              // User lifted a finger from a pinch, re-initialize panning for the remaining finger
              startX = (e as unknown as TouchEvent).touches[0].clientX;
              startY = (e as unknown as TouchEvent).touches[0].clientY;
              if (useStore.getState().gameState === 'arrange') {
                 const state = useStore.getState();
                 window.__panStart = { x: startX - state.gameCamera.x, y: startY - state.gameCamera.y };
              }
          }
          if ((e as unknown as TouchEvent).touches.length < 2) initialPinchDist = 0;
          if ((e as unknown as TouchEvent).touches.length === 0) {
              window.__panStart = null;
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
      if ((e as unknown as TouchEvent).touches.length >= 2) {
        const dx = (e as unknown as TouchEvent).touches[0].clientX - (e as unknown as TouchEvent).touches[1].clientX;
        const dy = (e as unknown as TouchEvent).touches[0].clientY - (e as unknown as TouchEvent).touches[1].clientY;
        initialPinchDist = Math.sqrt(dx*dx + dy*dy);
        const state = useStore.getState();
        initialZoom = state.gameCamera.zoom;
        
        const centerX = ((e as unknown as TouchEvent).touches[0].clientX + (e as unknown as TouchEvent).touches[1].clientX) / 2;
        const centerY = ((e as unknown as TouchEvent).touches[0].clientY + (e as unknown as TouchEvent).touches[1].clientY) / 2;
        
        const workspace = document.querySelector('.le-workspace');
        const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
        
        initialLocalX = (centerX - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
        initialLocalY = (centerY - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = useStore.getState();
      if (state.gameState !== 'arrange') return;
      
      if ((e as unknown as TouchEvent).touches.length >= 2 && initialPinchDist > 0) {
        e.preventDefault();
        const dx = (e as unknown as TouchEvent).touches[0].clientX - (e as unknown as TouchEvent).touches[1].clientX;
        const dy = (e as unknown as TouchEvent).touches[0].clientY - (e as unknown as TouchEvent).touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const zoomFactor = dist / initialPinchDist;
        let newZoom = initialZoom * zoomFactor;
        newZoom = Math.min(Math.max(newZoom, 0.1), 5);
        
        const currentCenterX = ((e as unknown as TouchEvent).touches[0].clientX + (e as unknown as TouchEvent).touches[1].clientX) / 2;
        const currentCenterY = ((e as unknown as TouchEvent).touches[0].clientY + (e as unknown as TouchEvent).touches[1].clientY) / 2;
        
        const workspace = document.querySelector('.le-workspace');
        const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
        
        const newCameraX = (currentCenterX - rect.left) - initialLocalX * newZoom;
        const newCameraY = (currentCenterY - rect.top) - initialLocalY * newZoom;
        
        state.updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if ((e as unknown as TouchEvent).touches.length < 2) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Long Press Right Click Mode Listener
  useEffect(() => {
    if (!isMobile) return;
    const onLongPress = (e: CustomEvent<{x: number, y: number}>) => {
         if (useStore.getState().gameState !== 'arrange') return;
         isMobileRightClickRef.current = true;
         isPanningRef.current = false;
         useStore.getState().clearSelection();
         
         const workspace = document.querySelector('.le-workspace');
         const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
         const state = useStore.getState();
         
         const localX = (e.detail.x - rect.left - state.gameCamera.x) / state.gameCamera.zoom;
         const localY = (e.detail.y - rect.top - state.gameCamera.y) / state.gameCamera.zoom;
         
         startTrail(localX, localY);
         intersectedBlocksRef.current.clear();
         
         checkTrailIntersection(localX, localY, localX, localY);
    };
    window.addEventListener('mobile-long-press', onLongPress as EventListener);
    return () => window.removeEventListener('mobile-long-press', onLongPress as EventListener);
  }, [isMobile, checkTrailIntersection, intersectedBlocksRef, isPanningRef, startTrail]);

  // Arrangement Phase Handlers
  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
      useStore.getState().setInteractionContext('main');
      if (gameState !== 'arrange') return;
      if (e.button === 1) { // Middle click
        startPan(e.global.x, e.global.y, useStore.getState().gameCamera.x, useStore.getState().gameCamera.y);
      } else if (e.button === 0 && e.target && e.target.label === 'background') { // Left click
        useStore.getState().closeContextMenu();
        if (isMobile) {
          startPan(e.global.x, e.global.y, useStore.getState().gameCamera.x, useStore.getState().gameCamera.y);
        } else {
          useStore.getState().clearSelection();
          const pos = e.currentTarget.toLocal(e.global);
          startSelection(pos.x, pos.y);
          const target = e.target as unknown as { setPointerCapture?: (id: number) => void };
          if (e.pointerId !== undefined && target.setPointerCapture) {
            target.setPointerCapture(e.pointerId);
          }
        }
      } else if (e.button === 2) { // Right click
        useStore.getState().closeContextMenu();
        useStore.getState().clearSelection();
        const state = useStore.getState();
        const localX = (e.global.x - state.gameCamera.x) / state.gameCamera.zoom;
        const localY = (e.global.y - state.gameCamera.y) / state.gameCamera.zoom;
        
        startTrail(localX, localY);

        checkTrailIntersection(localX, localY, localX, localY);
      }
  };

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      if (gameState === 'arrange' && isSelectingRef.current) {
          const pos = e.currentTarget.toLocal(e.global);
          const box = updateSelection(pos.x, pos.y);
          if (!box) return;
          const { x, y, w, h } = box;
          
          const state = useStore.getState();
          const directlySelectedGameBlocks = state.gameBlocks.filter(b => {
            return b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y;
          });
          
          const directlySelectedGroupRects = state.groupRects.filter(g => {
            return g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y;
          });

          const activeGroupIds = new Set([
            ...directlySelectedGameBlocks.filter(b => b.groupId).map(b => b.groupId as string),
            ...directlySelectedGroupRects.filter(g => g.groupId).map(g => g.groupId as string)
          ]);

          const selectedIds = state.gameBlocks.filter(b => directlySelectedGameBlocks.includes(b) || (b.groupId && activeGroupIds.has(b.groupId))).map(b => b.id);
          const selectedGIds = state.groupRects.filter(g => directlySelectedGroupRects.includes(g) || (g.groupId && activeGroupIds.has(g.groupId))).map(g => g.id);
          
          useStore.setState({ selectedBlockIds: selectedIds, selectedGroupRectIds: selectedGIds });
      } else if (gameState === 'arrange' && e.buttons === 2) {
          const state = useStore.getState();
          const localX = (e.global.x - state.gameCamera.x) / state.gameCamera.zoom;
          const localY = (e.global.y - state.gameCamera.y) / state.gameCamera.zoom;
          
          updateTrail(localX, localY, (p1, p2) => {
            checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
          });
      } else if (gameState === 'arrange' && isPanningRef.current) {
          if (isMobile) return; // Handled natively in trackTouches
          updatePan(e.global.x, e.global.y, useStore.getState().updateGameCamera);
      }
      if (e.buttons === 4 || (isMobile && gameState === 'arrange' && (e as unknown as TouchEvent).touches && (e as unknown as TouchEvent).touches.length === 2)) {
         updatePan(e.clientX, e.clientY, useStore.getState().updateGameCamera);
         return;
      }
  };

  const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
      endSelection();
      endPan();
      isMobileRightClickRef.current = false;
      endTrail();
      intersectedBlocksRef.current.clear();
      if (hasPausedRef.current) {
          useStore.temporal.getState().resume();
          hasPausedRef.current = false;
      }
      const target = e.target as unknown as { releasePointerCapture?: (id: number) => void };
      if (e.pointerId !== undefined && target && target.releasePointerCapture) {
        try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
  };



  return (
    <Application backgroundAlpha={0} resizeTo={window} antialias={true}>
      <TickerSync handleTick={handleTick} />
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
        <GridBackground showGrid={showGrid} theme={theme} zoom={camera.zoom} />
        <SelectionBoxRenderer selectionBox={selectionBox} zoom={camera.zoom} />
        <GroupRectRenderer />
        
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


