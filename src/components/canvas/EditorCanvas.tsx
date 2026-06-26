import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { NoteBlock } from '../blocks/NoteBlock';
import { shiftPitch } from '../../utils/pitchUtils';
import { GroupRectRenderer } from '../containers/GroupRectRenderer';
import { TrackRenderer } from '../containers/TrackRenderer';
import { TrailRenderer } from './shared/TrailRenderer';
import { GridBackground } from './shared/GridBackground';
import { SelectionBoxRenderer, GroupDrawBoxRenderer } from './shared/SelectionBoxRenderer';
import { useCanvasCamera } from '../../hooks/useCanvasCamera';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { lineIntersectsRect } from '../../utils/geometry';
import { getCanvasCenterLocal, trySetPointerCapture, tryReleasePointerCapture } from '../../utils/canvasUtils';
import { CanvasProvider } from '../../store/CanvasProvider';
import { Plus } from 'lucide-react';

export const EditorCanvas: React.FC = () => {
  const store = useStore();
  const { mode, latestPerformHit } = store;
  const camera = useLevelEditorStore((s) => s.camera);
  const blocks = useLevelEditorStore((s) => s.blocks);
  const { showGrid, theme } = useSettingsStore();

  const {
    startPan, updatePan, endPan,
    selectionBox, startSelection, updateSelection, endSelection,
    activeStrokesRef, currentStrokeId, startTrail, updateTrail, endTrail,
    intersectedBlocksRef, isSelectingRef
  } = useCanvasInteractions();

  const [groupDrawBox, setGroupDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const groupDrawStartRef = useRef<{ x: number; y: number } | null>(null);
  const groupDrawBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const containerRef = useRef<PIXI.Container>(null);

  const finishGroupDraw = useCallback(() => {
    const box = groupDrawBoxRef.current;
    if (box) {
      if (box.w > 10 && box.h > 10) {
        const id = useLevelEditorStore.getState().addGroupRect({ x: box.x, y: box.y, w: box.w, h: box.h });
        useLevelEditorStore.getState().selectGroupRect(id, false);
      }
      groupDrawBoxRef.current = null;
    }
    setGroupDrawBox(null);
    groupDrawStartRef.current = null;
  }, []);

  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleGlobalUp = () => finishGroupDraw();
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [finishGroupDraw]);

  useCanvasCamera({
    isPlayMode: mode === 'play',
    isActive: true,
    isEditorCanvas: true,
    onWheelIntercept: useCallback((e: WheelEvent) => {
      const editorState = useLevelEditorStore.getState();
      let targetBlockId = editorState.hoveredBlockId;
      let targetGroupRectId = editorState.hoveredGroupRectId;

      if (!targetBlockId && !targetGroupRectId) {
        const localX = (e.clientX - editorState.camera.x) / editorState.camera.zoom;
        const localY = (e.clientY - editorState.camera.y) / editorState.camera.zoom;

        for (let i = editorState.blocks.length - 1; i >= 0; i--) {
          const b = editorState.blocks[i];
          if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) {
            targetBlockId = b.id;
            break;
          }
        }

        if (!targetBlockId) {
          for (let i = editorState.groupRects.length - 1; i >= 0; i--) {
            const g = editorState.groupRects[i];
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
        const block = editorState.blocks.find(b => b.id === targetBlockId);
        if (block) {
          if (isVolume) {
            const newVolume = Math.round(Math.max(0, Math.min(1, (block.volume ?? 1) + delta * 0.1)) * 100) / 100;
            useLevelEditorStore.getState().updateBlock(block.id, { volume: newVolume, playedAt: Date.now(), playedVolumeMultiplier: 1 });
          } else {
            const newPitch = shiftPitch(block.pitch, delta);
            useLevelEditorStore.getState().updateBlock(block.id, { pitch: newPitch, playedAt: Date.now(), playedVolumeMultiplier: 1 });
          }
        }
        return true;
      } else if (targetGroupRectId && !e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const rect = editorState.groupRects.find(g => g.id === targetGroupRectId);
        if (rect) {
          const newVolume = Math.round(Math.max(0, Math.min(1, (rect.volume ?? 1) + delta * 0.1)) * 100) / 100;
          editorState.updateGroupRect(rect.id, { volume: newVolume });
        }
        return true;
      }
      return false;
    }, [])
  });

  const checkTrailIntersection = useCallback((x1: number, y1: number, x2: number, y2: number, isFirstPoint = false, startedOnBlock = false) => {
    const editorStore = useLevelEditorStore.getState();
    const blocksList = editorStore.blocks;
    const groupRects = editorStore.groupRects;

    const currentFrameIntersected = new Set<string>();

    blocksList.forEach(b => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
          editorStore.updateBlock(b.id, { playedAt: Date.now(), playedVolumeMultiplier: 1 });
        }
      }
    });

    groupRects.forEach(g => {
      if (g.enabled === false) return;
      if (lineIntersectsRect(x1, y1, x2, y2, g.x, g.y, g.w, g.h)) {
        currentFrameIntersected.add(`groupRect:${g.id}`);
        if (!intersectedBlocksRef.current.has(`groupRect:${g.id}`)) {
          if (isFirstPoint && startedOnBlock) {
            // skip
          } else {
            editorStore.updateGroupRect(g.id, { playedAt: Date.now() });
            const isInside = (bx: number, by: number, bw: number, bh: number) =>
              bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;
            const blocksInside = blocksList.filter(b => isInside(b.x, b.y, 60, 60));
            if (blocksInside.length > 0) {
              editorStore.updateBlocks(blocksInside.map(b => ({
                id: b.id,
                updates: { playedAt: Date.now(), playedVolumeMultiplier: g.volume ?? 1 }
              })));
            }
          }
        }
      }
    });

    intersectedBlocksRef.current = currentFrameIntersected;
  }, [intersectedBlocksRef]);

  // Perform mode: pointer lock
  useEffect(() => {
    if (mode === 'play') {
      document.body.requestPointerLock().catch(() => {});
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
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

  // Perform mode: mouse movement drives camera + trail
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
          const editorSt = useLevelEditorStore.getState();
          const { mouseSensitivity } = useSettingsStore.getState();
          const newCamX = editorSt.camera.x - pendingMovementX * mouseSensitivity;
          const newCamY = editorSt.camera.y - pendingMovementY * mouseSensitivity;

          if (buttonsPressed > 0) {
            const { x: centerX, y: centerY } = getCanvasCenterLocal('editor');
            const oldLocalX = (centerX - editorSt.camera.x) / editorSt.camera.zoom;
            const oldLocalY = (centerY - editorSt.camera.y) / editorSt.camera.zoom;
            const newLocalX = (centerX - newCamX) / editorSt.camera.zoom;
            const newLocalY = (centerY - newCamY) / editorSt.camera.zoom;
            checkTrailIntersection(oldLocalX, oldLocalY, newLocalX, newLocalY, false, false);
          }

          editorSt.updateCamera({ x: newCamX, y: newCamY });
          pendingMovementX = 0;
          pendingMovementY = 0;
          buttonsPressed = 0;
          rafId = null;
        });
      }
    };

    const handleMouseDown = () => {
      const editorSt = useLevelEditorStore.getState();
      const { x: centerX, y: centerY } = getCanvasCenterLocal('editor');
      const localX = (centerX - editorSt.camera.x) / editorSt.camera.zoom;
      const localY = (centerY - editorSt.camera.y) / editorSt.camera.zoom;
      let startedOnBlock = false;
      for (const b of editorSt.blocks) {
        if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) {
          startedOnBlock = true;
          break;
        }
      }
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(localX, localY, localX, localY, true, startedOnBlock);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.buttons === 0) intersectedBlocksRef.current.clear();
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
  }, [mode, checkTrailIntersection, intersectedBlocksRef]);

  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    useStore.getState().setInteractionContext('main');
    if (useStore.getState().mode === 'play') return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    const button = e.button;
    if (button === 1) {
      startPan(e.global.x, e.global.y, camera.x, camera.y);
    } else if (button === 0) {
      const sharedState = useStore.getState();
      const editorSt = useLevelEditorStore.getState();

      if (sharedState.mode === 'draw_track') {
        if (e.target && e.target.label === 'background') {
          const pos = e.currentTarget.toLocal(e.global);
          let trackId = sharedState.activeTrackId;
          if (!trackId) {
            trackId = editorSt.addTrack({ nodes: [], bpm: 120, loop: false });
            sharedState.setActiveTrackId(trackId);
          }
          const nodeId = editorSt.addTrackNode(trackId, { x: pos.x, y: pos.y });
          editorSt.setActiveNodeDrag({ trackId, nodeId, isNewNode: true });
          trySetPointerCapture(e.target, e.pointerId);
        }
        return;
      }

      if (sharedState.mode === 'draw_group') {
        if (e.target && e.target.label === 'background') {
          const now = Date.now();
          const pos = e.currentTarget.toLocal(e.global);
          const timeDiff = now - lastClickTimeRef.current;

          if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
            const dx = pos.x - lastClickPosRef.current.x;
            const dy = pos.y - lastClickPosRef.current.y;
            if (Math.hypot(dx, dy) < 20) {
              const g = editorSt.groupRects.find(g => g.id === editorSt.lastSelectedId);
              const w = g?.w || 200;
              const h = g?.h || 200;
              let nameToCopy = g?.name;
              if (nameToCopy && nameToCopy.startsWith('Group ')) nameToCopy = undefined;
              const id = editorSt.addGroupRect({ x: pos.x - w / 2, y: pos.y - h / 2, w, h, name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding });
              editorSt.selectGroupRect(id, false);
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
          trySetPointerCapture(e.target, e.pointerId);
        }
        return;
      }

      if (e.target && e.target.label === 'background') {
        editorSt.closeContextMenu();
        const now = Date.now();
        const posLocal = e.currentTarget.toLocal(e.global);
        const timeDiff = now - lastClickTimeRef.current;

        // Double-click to spawn
        if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
          const dx = posLocal.x - lastClickPosRef.current.x;
          const dy = posLocal.y - lastClickPosRef.current.y;
          if (Math.hypot(dx, dy) < 20) {
            let spawnType: 'block' | 'drum' | 'groupRect' | 'track';
            if (sharedState.mode === 'drum') {
              spawnType = 'drum';
            } else if (sharedState.mode === 'piano') {
              spawnType = 'block';
            } else {
              if (editorSt.lastSelectedType === 'groupRect') spawnType = 'groupRect';
              else if (editorSt.lastSelectedType === 'track') spawnType = 'track';
              else if (editorSt.lastSelectedType === 'block') {
                const b = editorSt.blocks.find(b => b.id === editorSt.lastSelectedId);
                spawnType = b?.instrument === 'percussion' ? 'drum' : 'block';
              } else {
                spawnType = 'block';
              }
            }

            if (spawnType === 'groupRect') {
              const g = editorSt.groupRects.find(g => g.id === editorSt.lastSelectedId);
              const w = g?.w || 200;
              const h = g?.h || 200;
              let nameToCopy = g?.name;
              if (nameToCopy && nameToCopy.startsWith('Group ')) nameToCopy = undefined;
              const id = editorSt.addGroupRect({ x: posLocal.x - w / 2, y: posLocal.y - h / 2, w, h, name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding });
              editorSt.selectGroupRect(id, false);
            } else if (spawnType === 'track') {
              const t = editorSt.tracks.find(t => t.id === editorSt.lastSelectedId);
              if (t && t.nodes.length > 0) {
                const firstNode = t.nodes[0];
                const dx2 = posLocal.x - firstNode.x;
                const dy2 = posLocal.y - firstNode.y;
                const newNodes = t.nodes.map(n => ({
                  ...n,
                  x: n.x + dx2,
                  y: n.y + dy2,
                  id: Math.random().toString(36).substring(2, 9)
                }));
                let nameToCopy = t.name;
                if (nameToCopy && nameToCopy.startsWith('Track ')) nameToCopy = undefined;
                const trackId = editorSt.addTrack({ bpm: t.bpm, loop: t.loop, name: nameToCopy, nodes: newNodes });
                editorSt.selectTrack(trackId, false);
              } else {
                const bpm = t?.bpm || 120;
                const loop = t?.loop || false;
                let nameToCopy = t?.name;
                if (nameToCopy && nameToCopy.startsWith('Track ')) nameToCopy = undefined;
                const trackId = editorSt.addTrack({ bpm, loop, name: nameToCopy, nodes: [] });
                editorSt.addTrackNode(trackId, { x: posLocal.x, y: posLocal.y });
                editorSt.selectTrack(trackId, false);
              }
            } else {
              const b = editorSt.blocks.find(b => b.id === editorSt.lastSelectedId);
              if (spawnType === 'drum') {
                editorSt.addBlock({
                  pitch: b?.instrument === 'percussion' ? b.pitch : 'kick',
                  instrument: 'percussion',
                  volume: b?.instrument === 'percussion' ? b.volume : 1,
                  keyBinding: b?.instrument === 'percussion' ? b.keyBinding : undefined,
                  x: posLocal.x - 30, y: posLocal.y - 30
                });
              } else {
                editorSt.addBlock({
                  pitch: b?.instrument !== 'percussion' && b ? b.pitch : 'C4',
                  instrument: b?.instrument !== 'percussion' && b ? b.instrument : 'piano',
                  volume: b?.instrument !== 'percussion' && b ? b.volume : 1,
                  keyBinding: b?.instrument !== 'percussion' && b ? b.keyBinding : undefined,
                  x: posLocal.x - 30, y: posLocal.y - 30
                });
              }
            }
            lastClickTimeRef.current = 0;
            return;
          }
        }

        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x: posLocal.x, y: posLocal.y };
        if (!e.ctrlKey && !e.shiftKey) editorSt.clearSelection();
        const pos = e.currentTarget.toLocal(e.global);
        startSelection(pos.x, pos.y);
        trySetPointerCapture(e.target, e.pointerId);
      }
    } else if (button === 2) {
      useLevelEditorStore.getState().closeContextMenu();
      if (e.target && e.target.label === 'background') useLevelEditorStore.getState().clearSelection();
      const pos = e.currentTarget.toLocal(e.global);
      let startedOnBlock = false;
      let current = e.target as PIXI.Container | null;
      while (current) {
        if (current.label === 'note-block') { startedOnBlock = true; break; }
        current = current.parent;
      }
      intersectedBlocksRef.current.clear();
      startTrail(pos.x, pos.y);
      checkTrailIntersection(pos.x, pos.y, pos.x, pos.y, true, startedOnBlock);
    }
  };

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
    if (useStore.getState().mode === 'play') return;
    if (updatePan(e.global.x, e.global.y, useLevelEditorStore.getState().updateCamera)) {
      // handled
    } else if (groupDrawStartRef.current && groupDrawBoxRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const start = groupDrawStartRef.current;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const newBox = { x, y, w: Math.abs(pos.x - start.x), h: Math.abs(pos.y - start.y) };
      setGroupDrawBox(newBox);
      groupDrawBoxRef.current = newBox;
    } else if (isSelectingRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const box = updateSelection(pos.x, pos.y);
      if (!box) return;
      const { x, y, w, h } = box;

      const editorBlocks = useLevelEditorStore.getState().blocks;
      const editorSt = useLevelEditorStore.getState();
      const tracks = editorSt.tracks;
      const groupRects = editorSt.groupRects;

      const directlySelectedBlocks = editorBlocks.filter(b =>
        b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y
      );
      const directlySelectedGroupRects = groupRects.filter(g =>
        g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y
      );
      const directlySelectedTracks = tracks.filter(t =>
        t.nodes.some(n => n.x >= x && n.x <= x + w && n.y >= y && n.y <= y + h)
      );

      const activeGroupIds = new Set([
        ...directlySelectedBlocks.filter(b => b.groupId).map(b => b.groupId as string),
        ...directlySelectedGroupRects.filter(g => g.groupId).map(g => g.groupId as string),
        ...directlySelectedTracks.filter(t => t.groupId).map(t => t.groupId as string),
      ]);

      useLevelEditorStore.setState({
        selectedBlockIds: editorBlocks
          .filter(b => directlySelectedBlocks.includes(b) || (b.groupId && activeGroupIds.has(b.groupId)))
          .map(b => b.id),
        selectedTrackIds: tracks
          .filter(t => directlySelectedTracks.includes(t) || (t.groupId && activeGroupIds.has(t.groupId)))
          .map(t => t.id),
        selectedGroupRectIds: groupRects
          .filter(g => directlySelectedGroupRects.includes(g) || (g.groupId && activeGroupIds.has(g.groupId)))
          .map(g => g.id),
      });
    } else if (e.buttons === 2 && !useLevelEditorStore.getState().activeNodeDrag) {
      const pos = e.currentTarget.toLocal(e.global);
      updateTrail(pos.x, pos.y, (p1, p2) => checkTrailIntersection(p1.x, p1.y, p2.x, p2.y));
    }
  };

  const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
    endPan();
    endSelection();
    finishGroupDraw();
    tryReleasePointerCapture(e.target, e.pointerId);
  };

  return (
    <CanvasProvider type="editor">
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <Application backgroundAlpha={0} resizeTo={window} antialias={true}>
          <pixiContainer
            ref={containerRef}
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
            <TrackRenderer onNodeDeletedByDrag={() => {
              activeStrokesRef.current = activeStrokesRef.current.filter(s => s.id !== currentStrokeId.current);
              endTrail();
            }} />

            {blocks.map(block => (
              <NoteBlock
                key={block.id}
                id={block.id}
                x={block.x}
                y={block.y}
                pitch={block.pitch}
                volume={block.volume}
                instrument={block.instrument}
                playedAt={block.playedAt}
                playedVolumeMultiplier={block.playedVolumeMultiplier}
                canvasContext="editor"
              />
            ))}

            <TrailRenderer activeStrokesRef={activeStrokesRef} currentStrokeId={currentStrokeId} />
          </pixiContainer>
        </Application>

        {/* Perform mode vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)',
            opacity: mode === 'play' ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
            zIndex: 10,
          }}
        />

        {/* Perform mode hit flash */}
        {mode === 'play' && latestPerformHit && Date.now() - latestPerformHit.time < 500 && (
          <div
            key={`perf-bg-${latestPerformHit.time}`}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle, transparent 0%, rgba(${(latestPerformHit.color >> 16) & 255}, ${(latestPerformHit.color >> 8) & 255}, ${latestPerformHit.color & 255}, 0.2) 100%)`,
              animation: 'flashBg 0.5s ease-out forwards',
              zIndex: 9,
            }}
          />
        )}

        {/* Perform mode crosshair */}
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
            zIndex: 11,
          }}
        >
          <Plus size={32} strokeWidth={1.5} />
        </div>
      </div>
    </CanvasProvider>
  );
};
