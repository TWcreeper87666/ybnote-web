import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { NoteBlock } from '../blocks/NoteBlock';
import { shiftPitch } from '../../utils/pitchUtils';
import { TrackRenderer } from '../containers/TrackRenderer';
import { GroupRectRenderer } from '../containers/GroupRectRenderer';
import { Plus } from 'lucide-react';
import { TrailRenderer } from './shared/TrailRenderer';
import { GridBackground } from './shared/GridBackground';
import { SelectionBoxRenderer, GroupDrawBoxRenderer } from './shared/SelectionBoxRenderer';
import { useCanvasCamera } from '../../hooks/useCanvasCamera';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';

export const Canvas: React.FC = () => {
  const { blocks, camera, showGrid, theme, mode, latestPerformHit } = useStore();
  const {
    startPan, updatePan, endPan,
    selectionBox, startSelection, updateSelection, endSelection,
    activeStrokesRef, currentStrokeId, startTrail, updateTrail, endTrail,
    intersectedBlocksRef, isSelectingRef
  } = useCanvasInteractions();

  const [groupDrawBox, setGroupDrawBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const groupDrawStartRef = useRef<{x: number, y: number} | null>(null);
  const groupDrawBoxRef = useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const containerRef = useRef<PIXI.Container>(null);

  const finishGroupDraw = useCallback(() => {
    const box = groupDrawBoxRef.current;
    if (box) {
      if (box.w > 10 && box.h > 10) {
        const id = useStore.getState().addGroupRect({ x: box.x, y: box.y, w: box.w, h: box.h });
        useStore.getState().selectGroupRect(id, false);
      }
      groupDrawBoxRef.current = null;
    }
    setGroupDrawBox(null);
    groupDrawStartRef.current = null;
  }, []);

  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    const handleGlobalUp = (e: PointerEvent) => {
      endPan();
      endSelection();
      finishGroupDraw();

      if (e.button === 2 || e.buttons === 0) {
        intersectedBlocksRef.current.clear();
        endTrail();
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [endPan, endSelection, endTrail, finishGroupDraw]);

  useCanvasCamera({
    isPlayMode: mode === 'play',
    isActive: true,
    onWheelIntercept: useCallback((e: WheelEvent) => {
      const state = useStore.getState();
      let targetBlockId = state.hoveredBlockId;
      let targetGroupRectId = state.hoveredGroupRectId;

      if (state.mode === 'play') {
        targetBlockId = null;
        targetGroupRectId = null;
      } else if (!targetBlockId && !targetGroupRectId) {
        const globalX = e.clientX;
        const globalY = e.clientY;
        const localX = (globalX - state.camera.x) / state.camera.zoom;
        const localY = (globalY - state.camera.y) / state.camera.zoom;
        
        for (let i = state.blocks.length - 1; i >= 0; i--) {
          const b = state.blocks[i];
          if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) {
            targetBlockId = b.id;
            break;
          }
        }

        if (!targetBlockId) {
          for (let i = state.groupRects.length - 1; i >= 0; i--) {
            const g = state.groupRects[i];
            if (localX >= g.x && localX <= g.x + g.w && localY >= g.y && localY <= g.y + g.h) {
              targetGroupRectId = g.id;
              break;
            }
          }
        }
      }

      if (targetBlockId && !e.ctrlKey) {
        e.preventDefault();
        const isVolume = e.shiftKey;
        const delta = e.deltaY > 0 ? -1 : 1;
        
        state.mutateBlocks(
          [targetBlockId as string],
          (b) => {
            if (isVolume) {
              const newVolume = Math.round(Math.max(0, Math.min(1, (b.volume ?? 1) + delta * 0.1)) * 100) / 100;
              return { volume: newVolume, playedAt: Date.now(), playedVolumeMultiplier: 1 };
            } else {
              const newPitch = shiftPitch(b.pitch, delta);
              return { pitch: newPitch, playedAt: Date.now(), playedVolumeMultiplier: 1 };
            }
          },
          { continuous: true }
        );
        return true;
      } else if (targetGroupRectId && !e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const rect = state.groupRects.find(g => g.id === targetGroupRectId);
        if (rect) {
          const newVolume = Math.round(Math.max(0, Math.min(1, (rect.volume ?? 1) + delta * 0.1)) * 100) / 100;
          state.updateGroupRect(rect.id, { volume: newVolume });
        }
        return true;
      }
      return false;
    }, [])
  });

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
          state.updateBlock(b.id, { playedAt: Date.now(), playedVolumeMultiplier: 1 });
        }
      }
    });

    groupRects.forEach(g => {
      if (g.enabled === false) return;
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
                updates: { playedAt: Date.now(), playedVolumeMultiplier: g.volume ?? 1 }
              })));
            }
          }
        }
      }
    });

    intersectedBlocksRef.current = currentFrameIntersected;
  };

  // Play Mode logic
  useEffect(() => {
    if (mode === 'play') {
      document.body.requestPointerLock().catch(err => {
        console.error("Pointer lock failed", err);
      });
    } else {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, [mode]);

  useEffect(() => {
    const handlePointerLockChange = () => {
      if (document.pointerLockElement !== document.body && useStore.getState().mode === 'play') {
         useStore.getState().setMode('select');
      }
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, []);

  useEffect(() => {
    if (mode !== 'play') return;
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
            
            checkTrailIntersection(oldLocalX, oldLocalY, newLocalX, newLocalY, false, false);
          }
          
          state.updateCamera({ x: newCamX, y: newCamY });
          
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
      
      let startedOnBlock = false;
      for (const b of state.blocks) {
        if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) {
          startedOnBlock = true;
          break;
        }
      }
      
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(localX, localY, localX, localY, true, startedOnBlock);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.buttons === 0) {
        intersectedBlocksRef.current.clear();
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
    };
  }, [mode]);

  const handlePointerDown = (e: any) => {
    if (useStore.getState().mode === 'play') return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const button = e.button;
    if (button === 1) { // Middle click to pan
      startPan(e.global.x, e.global.y, camera.x, camera.y);
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
          state.setActiveNodeDrag({ trackId, nodeId, isNewNode: true });
          if (e.pointerId !== undefined && e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
          }
        }
        return;
      }

      if (state.mode === 'draw_group') {
        if (e.target && e.target.label === 'background') {
          const now = Date.now();
          const pos = e.currentTarget.toLocal(e.global);
          const timeDiff = now - lastClickTimeRef.current;
          
          if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
            const dx = pos.x - lastClickPosRef.current.x;
            const dy = pos.y - lastClickPosRef.current.y;
            if (Math.hypot(dx, dy) < 20) {
               const state = useStore.getState();
               const g = state.groupRects.find(g => g.id === state.lastSelectedId);
               const w = g?.w || 200;
               const h = g?.h || 200;
               let nameToCopy = g?.name;
               if (nameToCopy && nameToCopy.startsWith('Group ')) nameToCopy = undefined;
               
               const id = state.addGroupRect({ x: pos.x - w/2, y: pos.y - h/2, w, h, name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding });
               state.selectGroupRect(id, false);
               lastClickTimeRef.current = 0;
               return;
            }
          }
          
          lastClickTimeRef.current = now;
          lastClickPosRef.current = { x: pos.x, y: pos.y };

          groupDrawStartRef.current = { x: pos.x, y: pos.y };
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
        useStore.getState().closeContextMenu();
        const now = Date.now();
        const posLocal = e.currentTarget.toLocal(e.global);
        const timeDiff = now - lastClickTimeRef.current;
        
        // Double click to spawn a noteblock (ignore < 50ms as it's likely a duplicate event)
        if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
          const dx = posLocal.x - lastClickPosRef.current.x;
          const dy = posLocal.y - lastClickPosRef.current.y;
          if (Math.hypot(dx, dy) < 20) {
            let spawnType: 'block' | 'drum' | 'groupRect' | 'track' | null = null;
            if (state.mode === 'drum') spawnType = 'drum';
            else {
              if (state.lastSelectedType === 'groupRect') spawnType = 'groupRect';
              else if (state.lastSelectedType === 'track') spawnType = 'track';
              else if (state.lastSelectedType === 'block') {
                 const b = state.blocks.find(b => b.id === state.lastSelectedId);
                 if (b?.instrument === 'percussion') spawnType = 'drum';
                 else spawnType = 'block';
              } else {
                 spawnType = 'block';
              }
            }

            if (spawnType === 'groupRect') {
               const g = state.groupRects.find(g => g.id === state.lastSelectedId);
               const w = g?.w || 200;
               const h = g?.h || 200;
               let nameToCopy = g?.name;
               if (nameToCopy && nameToCopy.startsWith('Group ')) nameToCopy = undefined;
               
               const id = state.addGroupRect({ 
                 x: posLocal.x - w/2, 
                 y: posLocal.y - h/2, 
                 w, h, 
                 name: nameToCopy, 
                 volume: g?.volume, 
                 keyBinding: g?.keyBinding 
               });
               state.selectGroupRect(id, false);
            } else if (spawnType === 'track') {
               const t = state.tracks.find(t => t.id === state.lastSelectedId);
               if (t && t.nodes.length > 0) {
                 const firstNode = t.nodes[0];
                 const dx = posLocal.x - firstNode.x;
                 const dy = posLocal.y - firstNode.y;
                 const newNodes = t.nodes.map(n => ({ 
                   ...n, 
                   x: n.x + dx, 
                   y: n.y + dy, 
                   id: Math.random().toString(36).substring(2, 9) 
                 }));
                 
                 let nameToCopy = t.name;
                 if (nameToCopy && nameToCopy.startsWith('Track ')) nameToCopy = undefined;

                 const trackId = state.addTrack({
                   bpm: t.bpm,
                   loop: t.loop,
                   name: nameToCopy,
                   nodes: newNodes,
                 });
                 state.selectTrack(trackId, false);
               } else {
                 const bpm = t?.bpm || 120;
                 const loop = t?.loop || false;
                 let nameToCopy = t?.name;
                 if (nameToCopy && nameToCopy.startsWith('Track ')) nameToCopy = undefined;

                 const trackId = state.addTrack({ bpm, loop, name: nameToCopy, nodes: [] });
                 state.addTrackNode(trackId, { x: posLocal.x, y: posLocal.y });
                 state.selectTrack(trackId, false);
               }
            } else {
               const b = state.blocks.find(b => b.id === state.lastSelectedId);
               if (spawnType === 'drum') {
                 state.addBlock({ 
                   pitch: b?.instrument === 'percussion' ? b.pitch : 'kick', 
                   instrument: 'percussion', 
                   volume: b?.instrument === 'percussion' ? b.volume : 1, 
                   keyBinding: b?.instrument === 'percussion' ? b.keyBinding : undefined,
                   x: posLocal.x - 30, y: posLocal.y - 30 
                 });
               } else {
                 state.addBlock({ 
                   pitch: b?.instrument !== 'percussion' && b ? b.pitch : 'C4', 
                   instrument: b?.instrument !== 'percussion' && b ? b.instrument : 'piano', 
                   volume: b?.instrument !== 'percussion' && b ? b.volume : 1, 
                   keyBinding: b?.instrument !== 'percussion' && b ? b.keyBinding : undefined,
                   x: posLocal.x - 30, y: posLocal.y - 30 
                 });
               }
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
        startSelection(pos.x, pos.y);
        if (e.pointerId !== undefined && e.target.setPointerCapture) {
          e.target.setPointerCapture(e.pointerId);
        }
      }
    } else if (button === 2) {
      useStore.getState().closeContextMenu();
      if (e.target && e.target.label === 'background') {
        useStore.getState().clearSelection();
      }
      const pos = e.currentTarget.toLocal(e.global);
      startTrail(pos.x, pos.y);
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
  };

  const handlePointerMove = (e: any) => {
    if (useStore.getState().mode === 'play') return;
    if (updatePan(e.global.x, e.global.y, useStore.getState().updateCamera)) {
      // handled
    } else if (groupDrawStartRef.current && groupDrawBoxRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const start = groupDrawStartRef.current;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      const newBox = { x, y, w, h };
      setGroupDrawBox(newBox);
      groupDrawBoxRef.current = newBox;
    } else if (isSelectingRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const box = updateSelection(pos.x, pos.y);
      if (!box) return;
      const { x, y, w, h } = box;
      
      const blocks = useStore.getState().blocks;
      const tracks = useStore.getState().tracks;
      const groupRects = useStore.getState().groupRects;

      const directlySelectedBlocks = blocks.filter(b => {
        return b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y;
      });
      
      const directlySelectedTracks = tracks.filter(t => {
        return t.nodes.some(n => n.x >= x && n.x <= x + w && n.y >= y && n.y <= y + h);
      });

      const directlySelectedGroupRects = groupRects.filter(g => {
        return g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y;
      });

      const activeGroupIds = new Set([
        ...directlySelectedBlocks.filter(b => b.groupId).map(b => b.groupId as string),
        ...directlySelectedTracks.filter(t => t.groupId).map(t => t.groupId as string),
        ...directlySelectedGroupRects.filter(g => g.groupId).map(g => g.groupId as string)
      ]);

      const selectedIds = blocks.filter(b => directlySelectedBlocks.includes(b) || (b.groupId && activeGroupIds.has(b.groupId))).map(b => b.id);
      const selectedTIds = tracks.filter(t => directlySelectedTracks.includes(t) || (t.groupId && activeGroupIds.has(t.groupId))).map(t => t.id);
      const selectedGIds = groupRects.filter(g => directlySelectedGroupRects.includes(g) || (g.groupId && activeGroupIds.has(g.groupId))).map(g => g.id);
      
      useStore.setState({ selectedBlockIds: selectedIds, selectedTrackIds: selectedTIds, selectedGroupRectIds: selectedGIds });
    } else if (e.buttons === 2) {
      const pos = e.currentTarget.toLocal(e.global);
      updateTrail(pos.x, pos.y, (p1, p2) => {
        checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
      });
    }
  };

  const handlePointerUp = (e: any) => {
    if (useStore.getState().mode === 'play') return;
    endPan();
    endSelection();
    
    finishGroupDraw();

    if (e.pointerId !== undefined && e.target && e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  };



  return (
    <div 
      style={{ width: '100%', height: '100%', position: 'relative' }} 
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
          sortableChildren={true}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerUpOutside={handlePointerUp}
        >
          <GridBackground showGrid={showGrid} theme={theme} zoom={camera.zoom} />
          
          <SelectionBoxRenderer selectionBox={selectionBox} zoom={camera.zoom} />
          <GroupDrawBoxRenderer groupDrawBox={groupDrawBox} zoom={camera.zoom} />

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
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)',
          opacity: mode === 'play' ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
          zIndex: 10
        }}
      />

      {mode === 'play' && latestPerformHit && Date.now() - latestPerformHit.time < 500 && (
         <div 
           key={`perf-bg-${latestPerformHit.time}`}
           style={{
             position: 'absolute',
             inset: 0,
             pointerEvents: 'none',
             background: `radial-gradient(circle, transparent 0%, rgba(${(latestPerformHit.color >> 16) & 255}, ${(latestPerformHit.color >> 8) & 255}, ${latestPerformHit.color & 255}, 0.2) 100%)`,
             animation: 'flashBg 0.5s ease-out forwards',
             zIndex: 9
           }}
         />
      )}
      
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          opacity: mode === 'play' ? 0.5 : 0,
          transition: 'opacity 0.3s ease-in-out',
          color: 'white',
          zIndex: 11
        }}
      >
        <Plus size={32} strokeWidth={1.5} />
      </div>
    </div>
  );
};
