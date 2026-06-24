// hooks/useEditorInteraction.ts
import { useRef, useState, useCallback, useEffect } from "react";
import * as PIXI from "pixi.js";
import { useStore } from "../store/useStore";
import { isLevelEditor } from "../utils/routeUtils";
import type { CameraState, Point } from "../types";

export function useEditorInteraction(
  camera: { x: number; y: number; zoom: number },
  interactions: {
    startPan: (x: number, y: number, camX: number, camY: number) => void;
    updatePan: (x: number, y: number, updateCamera: (camera: Partial<CameraState>) => void) => boolean;
    endPan: () => void;
    startSelection: (x: number, y: number) => void;
    updateSelection: (x: number, y: number) => { x: number; y: number; w: number; h: number } | null;
    endSelection: () => void;
    startTrail: (x: number, y: number) => void;
    updateTrail: (x: number, y: number, cb: (p1: Point, p2: Point) => void) => void;
    isSelectingRef: React.RefObject<boolean>;
  },
  checkTrailIntersection: (
    x1: number, y1: number, x2: number, y2: number,
    isFirstPoint?: boolean, startedOnBlock?: boolean,
  ) => void,
  intersectedBlocksRef: React.RefObject<Set<string>>,
) {
  const {
    startPan, updatePan, endPan,
    startSelection, updateSelection, endSelection,
    startTrail, updateTrail, isSelectingRef,
  } = interactions;

  const [groupDrawBox, setGroupDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const groupDrawStartRef = useRef<Point | null>(null);
  const groupDrawBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<Point | null>(null);

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

  useEffect(() => {
    const handleGlobalUp = () => finishGroupDraw();
    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("pointercancel", handleGlobalUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("pointercancel", handleGlobalUp);
    };
  }, [finishGroupDraw]);

  const onPointerDown = useCallback((e: PIXI.FederatedPointerEvent) => {
    useStore.getState().setInteractionContext("main");
    if (useStore.getState().mode === "play") return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const button = e.button;

    if (button === 1) {
      startPan(e.global.x, e.global.y, camera.x, camera.y);
      return;
    }

    if (button === 0) {
      const state = useStore.getState();

      if (state.mode === "draw_track") {
        if (e.target && e.target.label === "background") {
          const pos = e.currentTarget.toLocal(e.global);
          let trackId = state.activeTrackId;
          if (!trackId) {
            trackId = state.addTrack({ nodes: [], bpm: 120, loop: false });
            state.setActiveTrackId(trackId);
          }
          const nodeId = state.addTrackNode(trackId, { x: pos.x, y: pos.y });
          state.setActiveNodeDrag({ trackId, nodeId, isNewNode: true });
          const target = e.target as unknown as { setPointerCapture?: (id: number) => void };
          if (e.pointerId !== undefined && target.setPointerCapture) {
            target.setPointerCapture(e.pointerId);
          }
        }
        return;
      }

      if (state.mode === "draw_group") {
        if (e.target && e.target.label === "background") {
          const now = Date.now();
          const pos = e.currentTarget.toLocal(e.global);
          const timeDiff = now - lastClickTimeRef.current;

          if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
            const dx = pos.x - lastClickPosRef.current.x;
            const dy = pos.y - lastClickPosRef.current.y;
            if (Math.hypot(dx, dy) < 20) {
              const s = useStore.getState();
              const g = s.groupRects.find((g) => g.id === s.lastSelectedId);
              const w = g?.w || 200;
              const h = g?.h || 200;
              let nameToCopy = g?.name;
              if (nameToCopy && nameToCopy.startsWith("Group ")) nameToCopy = undefined;

              const id = s.addGroupRect({
                x: pos.x - w / 2, y: pos.y - h / 2, w, h,
                name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding,
              });
              s.selectGroupRect(id, false);
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
          if (e.pointerId !== undefined && target.setPointerCapture) {
            target.setPointerCapture(e.pointerId);
          }
        }
        return;
      }

      if (e.target && e.target.label === "background") {
        useStore.getState().closeContextMenu();
        const now = Date.now();
        const posLocal = e.currentTarget.toLocal(e.global);
        const timeDiff = now - lastClickTimeRef.current;

        if (timeDiff > 50 && timeDiff < 350 && lastClickPosRef.current) {
          const dx = posLocal.x - lastClickPosRef.current.x;
          const dy = posLocal.y - lastClickPosRef.current.y;
          if (Math.hypot(dx, dy) < 20) {
            handleDoubleClickSpawn(state, posLocal);
            lastClickTimeRef.current = 0;
            return;
          }
        }
        lastClickTimeRef.current = now;
        lastClickPosRef.current = { x: posLocal.x, y: posLocal.y };

        if (!e.ctrlKey && !e.shiftKey) {
          state.clearSelection();
        }
        const pos = e.currentTarget.toLocal(e.global);
        startSelection(pos.x, pos.y);
        const target = e.target as unknown as { setPointerCapture?: (id: number) => void };
        if (e.pointerId !== undefined && target.setPointerCapture) {
          target.setPointerCapture(e.pointerId);
        }
      }
      return;
    }

    if (button === 2) {
      useStore.getState().closeContextMenu();
      if (e.target && e.target.label === "background") {
        useStore.getState().clearSelection();
      }
      const pos = e.currentTarget.toLocal(e.global);
      startTrail(pos.x, pos.y);
      let startedOnBlock = false;
      let current = e.target as PIXI.Container | null;
      while (current) {
        if (current.label === "note-block") {
          startedOnBlock = true;
          break;
        }
        current = current.parent;
      }
      intersectedBlocksRef.current.clear();
      checkTrailIntersection(pos.x, pos.y, pos.x, pos.y, true, startedOnBlock);
    }
  }, [camera, startPan, startSelection, startTrail, checkTrailIntersection, intersectedBlocksRef]);

  const onPointerMove = useCallback((e: PIXI.FederatedPointerEvent) => {
    if (useStore.getState().mode === "play") return;
    if (updatePan(e.global.x, e.global.y, useStore.getState().updateCamera)) {
      return;
    }
    if (groupDrawStartRef.current && groupDrawBoxRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const start = groupDrawStartRef.current;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      const newBox = { x, y, w, h };
      setGroupDrawBox(newBox);
      groupDrawBoxRef.current = newBox;
      return;
    }
    if (isSelectingRef.current) {
      const pos = e.currentTarget.toLocal(e.global);
      const box = updateSelection(pos.x, pos.y);
      if (!box) return;
      applyMarqueeSelection(box);
      return;
    }
    if (e.buttons === 2) {
      const pos = e.currentTarget.toLocal(e.global);
      updateTrail(pos.x, pos.y, (p1, p2) => {
        checkTrailIntersection(p1.x, p1.y, p2.x, p2.y);
      });
    }
  }, [updatePan, updateSelection, updateTrail, isSelectingRef, checkTrailIntersection]);

  const onPointerUp = useCallback((e: PIXI.FederatedPointerEvent) => {
    if (useStore.getState().mode === "play") return;
    endPan();
    endSelection();
    finishGroupDraw();

    const target = e.target as unknown as { releasePointerCapture?: (id: number) => void };
    if (e.pointerId !== undefined && target && target.releasePointerCapture) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }, [endPan, endSelection, finishGroupDraw]);

  return { onPointerDown, onPointerMove, onPointerUp, groupDrawBox };
}

// --- 內部 helper：雙擊生成 block/drum/groupRect/track ---
function handleDoubleClickSpawn(state: ReturnType<typeof useStore.getState>, posLocal: Point) {
  let spawnType: "block" | "drum" | "groupRect" | "track";
  if (state.mode === "drum") spawnType = "drum";
  else if (state.lastSelectedType === "groupRect") spawnType = "groupRect";
  else if (state.lastSelectedType === "track") spawnType = "track";
  else if (state.lastSelectedType === "block") {
    const b = state.blocks.find((b) => b.id === state.lastSelectedId);
    spawnType = b?.instrument === "percussion" ? "drum" : "block";
  } else {
    spawnType = "block";
  }

  if (spawnType === "groupRect") {
    const g = state.groupRects.find((g) => g.id === state.lastSelectedId);
    const w = g?.w || 200;
    const h = g?.h || 200;
    let nameToCopy = g?.name;
    if (nameToCopy && nameToCopy.startsWith("Group ")) nameToCopy = undefined;
    const id = state.addGroupRect({
      x: posLocal.x - w / 2, y: posLocal.y - h / 2, w, h,
      name: nameToCopy, volume: g?.volume, keyBinding: g?.keyBinding,
    });
    state.selectGroupRect(id, false);
  } else if (spawnType === "track") {
    const t = state.tracks.find((t) => t.id === state.lastSelectedId);
    if (t && t.nodes.length > 0) {
      const firstNode = t.nodes[0];
      const dx = posLocal.x - firstNode.x;
      const dy = posLocal.y - firstNode.y;
      const newNodes = t.nodes.map((n) => ({
        ...n, x: n.x + dx, y: n.y + dy,
        id: Math.random().toString(36).substring(2, 9),
      }));
      let nameToCopy = t.name;
      if (nameToCopy && nameToCopy.startsWith("Track ")) nameToCopy = undefined;
      const trackId = state.addTrack({ bpm: t.bpm, loop: t.loop, name: nameToCopy, nodes: newNodes });
      state.selectTrack(trackId, false);
    } else {
      const bpm = t?.bpm || 120;
      const loop = t?.loop || false;
      let nameToCopy = t?.name;
      if (nameToCopy && nameToCopy.startsWith("Track ")) nameToCopy = undefined;
      const trackId = state.addTrack({ bpm, loop, name: nameToCopy, nodes: [] });
      state.addTrackNode(trackId, { x: posLocal.x, y: posLocal.y });
      state.selectTrack(trackId, false);
    }
  } else {
    const b = state.blocks.find((b) => b.id === state.lastSelectedId);
    if (spawnType === "drum") {
      state.addBlock({
        pitch: b?.instrument === "percussion" ? b.pitch : "kick",
        instrument: "percussion",
        volume: b?.instrument === "percussion" ? b.volume : 1,
        keyBinding: b?.instrument === "percussion" ? b.keyBinding : undefined,
        x: posLocal.x - 30, y: posLocal.y - 30,
      });
    } else {
      state.addBlock({
        pitch: b?.instrument !== "percussion" && b ? b.pitch : "C4",
        instrument: b?.instrument !== "percussion" && b ? b.instrument : "piano",
        volume: b?.instrument !== "percussion" && b ? b.volume : 1,
        keyBinding: b?.instrument !== "percussion" && b ? b.keyBinding : undefined,
        x: posLocal.x - 30, y: posLocal.y - 30,
      });
    }
  }
}

// --- 內部 helper：marquee selection 套用結果 ---
function applyMarqueeSelection(box: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = box;
  const blocksList = isLevelEditor() ? useStore.getState().gameBlocks : useStore.getState().blocks;
  const tracks = useStore.getState().tracks;
  const groupRects = useStore.getState().groupRects;

  const directlySelectedBlocks = blocksList.filter(
    (b) => b.x < x + w && b.x + 60 > x && b.y < y + h && b.y + 60 > y,
  );
  const directlySelectedTracks = tracks.filter((t) =>
    t.nodes.some((n) => n.x >= x && n.x <= x + w && n.y >= y && n.y <= y + h),
  );
  const directlySelectedGroupRects = groupRects.filter(
    (g) => g.x < x + w && g.x + g.w > x && g.y < y + h && g.y + g.h > y,
  );

  const activeGroupIds = new Set([
    ...directlySelectedBlocks.filter((b) => b.groupId).map((b) => b.groupId as string),
    ...directlySelectedTracks.filter((t) => t.groupId).map((t) => t.groupId as string),
    ...directlySelectedGroupRects.filter((g) => g.groupId).map((g) => g.groupId as string),
  ]);

  const selectedIds = blocksList
    .filter((b) => directlySelectedBlocks.includes(b) || (b.groupId && activeGroupIds.has(b.groupId)))
    .map((b) => b.id);
  const selectedTIds = tracks
    .filter((t) => directlySelectedTracks.includes(t) || (t.groupId && activeGroupIds.has(t.groupId)))
    .map((t) => t.id);
  const selectedGIds = groupRects
    .filter((g) => directlySelectedGroupRects.includes(g) || (g.groupId && activeGroupIds.has(g.groupId)))
    .map((g) => g.id);

  useStore.setState({
    selectedBlockIds: selectedIds,
    selectedTrackIds: selectedTIds,
    selectedGroupRectIds: selectedGIds,
  });
}