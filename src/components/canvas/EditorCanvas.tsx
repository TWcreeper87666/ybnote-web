import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { NoteBlock } from '../blocks/NoteBlock';
import { shiftPitch } from '../../utils/pitchUtils';
import { GroupRectRenderer } from '../containers/GroupRectRenderer';
import { TrailRenderer } from './shared/TrailRenderer';
import { GridBackground } from './shared/GridBackground';
import { SelectionBoxRenderer, GroupDrawBoxRenderer } from './shared/SelectionBoxRenderer';
import { useCanvasCamera } from '../../hooks/useCanvasCamera';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { lineIntersectsRect } from '../../utils/geometry';
import { CanvasContext } from './CanvasContext';

export const EditorCanvas: React.FC = () => {
  const store = useStore();
  const { camera, mode } = store;
  const blocks = useLevelEditorStore((s) => s.gameBlocks);
  const { showGrid, theme } = useSettingsStore();

  const {
    startPan, updatePan, endPan,
    selectionBox, startSelection, updateSelection, endSelection,
    activeStrokesRef, currentStrokeId, startTrail, updateTrail,
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
        const id = useStore.getState().addGroupRect({ x: box.x, y: box.y, w: box.w, h: box.h });
        useStore.getState().selectGroupRect(id, false);
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
    isPlayMode: false,
    isActive: true,
    onWheelIntercept: useCallback((e: WheelEvent) => {
      const state = useStore.getState();
      const editorState = useLevelEditorStore.getState();
      let targetBlockId = state.hoveredBlockId;
      let targetGroupRectId = state.hoveredGroupRectId;

      if (!targetBlockId && !targetGroupRectId) {
        const localX = (e.clientX - state.camera.x) / state.camera.zoom;
        const localY = (e.clientY - state.camera.y) / state.camera.zoom;

        for (let i = editorState.gameBlocks.length - 1; i >= 0; i--) {
          const b = editorState.gameBlocks[i];
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
        const block = editorState.gameBlocks.find(b => b.id === targetBlockId);
        if (block) {
          if (isVolume) {
            const newVolume = Math.round(Math.max(0, Math.min(1, (block.volume ?? 1) + delta * 0.1)) * 100) / 100;
            useLevelEditorStore.getState().updateGameBlock(block.id, { volume: newVolume, playedAt: Date.now(), playedVolumeMultiplier: 1 });
          } else {
            const newPitch = shiftPitch(block.pitch, delta);
            useLevelEditorStore.getState().updateGameBlock(block.id, { pitch: newPitch, playedAt: Date.now(), playedVolumeMultiplier: 1 });
          }
        }
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

  const checkTrailIntersection = useCallback((x1: number, y1: number, x2: number, y2: number, isFirstPoint = false, startedOnBlock = false) => {
    const editorStore = useLevelEditorStore.getState();
    const state = useStore.getState();
    const blocksList = editorStore.gameBlocks;
    const groupRects = state.groupRects;

    const currentFrameIntersected = new Set<string>();

    blocksList.forEach(b => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) {
          editorStore.updateGameBlock(b.id, { playedAt: Date.now(), playedVolumeMultiplier: 1 });
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
            state.updateGroupRect(g.id, { playedAt: Date.now() });
            const isInside = (bx: number, by: number, bw: number, bh: number) =>
              bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;
            const blocksInside = blocksList.filter(b => isInside(b.x, b.y, 60, 60));
            if (blocksInside.length > 0) {
              editorStore.updateGameBlocks(blocksInside.map(b => ({
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

  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    useStore.getState().setInteractionContext('main');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    const button = e.button;
    if (button === 1) {
      startPan(e.global.x, e.global.y, camera.x, camera.y);
    } else if (button === 0) {
      const state = useStore.getState();

      if (state.mode === 'draw_group') {
        if (e.target && e.target.label === 'background') {
          const now = Date.now();
          const pos = e.currentTarget.toLocal(e.global);
          const timeDiff = now - lastClickTimeRef.current;

          if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
            const dx = pos.x - lastClickPosRef.current.x;
            const dy = pos.y - lastClickPosRef.current.y;
            if (Math.hypot(dx, dy) < 20) {
              const g = state.groupRects.find(g => g.id === state.lastSelectedId);
              const w = g?.w || 200;
              const h = g?.h || 200;
              let nameToCopy = g?.name;
              if (nameToCopy && nameToCopy.startsWith('Group ')) nameToCopy = undefined;
              const id = state.addGroupRect({ x: pos.x - w / 2, y: pos.y - h / 2, w, h, name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding });
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
          const target = e.target as unknown as { setPointerCapture?: (id: number) => void };
          if (e.pointerId !== undefined && target.setPointerCapture) target.setPointerCapture(e.pointerId);
        }
        return;
      }

      if (e.target && e.target.label === 'background') {
        useStore.getState().closeContextMenu();
        lastClickTimeRef.current = Date.now();
        lastClickPosRef.current = { x: e.currentTarget.toLocal(e.global).x, y: e.currentTarget.toLocal(e.global).y };
        if (!e.ctrlKey && !e.shiftKey) state.clearSelection();
        const pos = e.currentTarget.toLocal(e.global);
        startSelection(pos.x, pos.y);
        const target = e.target as unknown as { setPointerCapture?: (id: number) => void };
        if (e.pointerId !== undefined && target.setPointerCapture) target.setPointerCapture(e.pointerId);
      }
    } else if (button === 2) {
      useStore.getState().closeContextMenu();
      if (e.target && e.target.label === 'background') useStore.getState().clearSelection();
      const pos = e.currentTarget.toLocal(e.global);
      startTrail(pos.x, pos.y);
      let startedOnBlock = false;
      let current = e.target as PIXI.Container | null;
      while (current) {
        if (current.label === 'note-block') { startedOnBlock = true; break; }
        current = current.parent;
      }
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(pos.x, pos.y, pos.x, pos.y, true, startedOnBlock);
    }
  };

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
    if (updatePan(e.global.x, e.global.y, useStore.getState().updateCamera)) {
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

      const editorBlocks = useLevelEditorStore.getState().gameBlocks;
      const state = useStore.getState();
      const tracks = state.tracks;
      const groupRects = state.groupRects;

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

      useStore.setState({
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
    } else if (e.buttons === 2) {
      const pos = e.currentTarget.toLocal(e.global);
      updateTrail(pos.x, pos.y, (p1, p2) => checkTrailIntersection(p1.x, p1.y, p2.x, p2.y));
    }
  };

  const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
    endPan();
    endSelection();
    finishGroupDraw();
    const target = e.target as unknown as { releasePointerCapture?: (id: number) => void };
    if (e.pointerId !== undefined && target?.releasePointerCapture) {
      try { target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };

  return (
    <CanvasContext.Provider value="editor">
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
      </div>
    </CanvasContext.Provider>
  );
};
