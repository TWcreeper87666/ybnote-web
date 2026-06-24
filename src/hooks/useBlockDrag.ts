import { useState, useRef, useEffect, useContext } from "react";
import { useStore as useZustandStore } from "zustand";
import { useStore } from "../store/useStore";
import { useLevelEditorStore } from "../store/useLevelEditorStore";
import { getAllChartNotes } from "../utils/chartUtils";
import { useIsMobile } from "./useIsMobile";
import { isLevelEditor } from "../utils/routeUtils";
import { useSettingsStore } from "../store";
import { CanvasStoreContext } from "../store/CanvasStoreContext";
import type { CameraState } from "../types";

export const useBlockDrag = (
  id: string,
  x: number,
  y: number,
  isSelected: boolean,
) => {
  const { snapToGrid } = useSettingsStore((s) => s);

  // Use canvas context store if available (playground/level editor), else fall back to global store
  const canvasStoreCtx = useContext(CanvasStoreContext);
  const camera = useZustandStore(
    (canvasStoreCtx ?? useStore) as Parameters<typeof useZustandStore>[0],
    (s: any) => s.camera as CameraState,
  );

  const isMobile = useIsMobile();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const clickStartPosRef = useRef<{
    x: number;
    y: number;
    pointerId?: number;
  } | null>(null);
  const wasSelectedRef = useRef(false);
  const lastClickTimeRef = useRef(0);

  const handlePointerDown = (e: import("pixi.js").FederatedPointerEvent) => {
    // Use context store if available
    const cs = canvasStoreCtx ? (canvasStoreCtx.getState() as any) : useStore.getState();
    const mode = cs?.mode;
    if (mode === "play") return;

    const editorState = useLevelEditorStore.getState();
    if (
      editorState.activeTab === "charting" &&
      editorState.chartingAwaitingPick
    ) {
      const chartNotes = editorState.midiData
        ? getAllChartNotes(editorState.midiData)
        : [];
      const entry = chartNotes[editorState.chartingNoteIndex];
      if (entry) {
        e.stopPropagation();
        editorState.assignNoteTarget(
          entry.note.id,
          entry.track.id,
          id,
          "block",
        );
        useLevelEditorStore.getState().togglePlayback();
        return;
      }
    }

    const button = e.button;
    const isMultiSelect = e.ctrlKey || e.shiftKey;

    if (button === 0) {
      if (cs?.contextMenu && cs.contextMenu.blockId !== id) {
        cs.closeContextMenu?.();
        // Also close in global store for context menu rendering
        useStore.getState().closeContextMenu();
      }
      e.stopPropagation();
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
      };
      let shouldDrag: boolean;
      if (isMultiSelect) {
        cs?.selectBlock(id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          cs?.selectBlock(id, false);
        }
        shouldDrag = true;
      }

      if (shouldDrag) {
        setIsDragging(true);
        const pos = e.currentTarget.parent?.toLocal(e.global) || {
          x: e.global.x,
          y: e.global.y,
        };
        setDragOffset({ x: pos.x - x, y: pos.y - y });
      }
    } else if (button === 2) {
      // Handled by Canvas via event bubbling and target checking
    }
  };

  const handlePointerUp = (e: import("pixi.js").FederatedPointerEvent) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      const isClick = Math.sqrt(dx * dx + dy * dy) < 5;
      if (isClick) {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          if (!e.ctrlKey && !e.shiftKey) {
            // Open context menu in global store (ContextMenu component reads from useStore)
            useStore.getState().openContextMenu({
              x: e.clientX,
              y: e.clientY,
              blockId: id,
            });
          }
          lastClickTimeRef.current = 0;
        } else {
          lastClickTimeRef.current = now;
        }
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    // Get state from context store if available
    const cs = canvasStoreCtx ? (canvasStoreCtx.getState() as any) : useStore.getState();

    let hasPaused = false;
    const selectedBlocks = cs.blocks?.filter((b: any) => cs.selectedBlockIds?.includes(b.id)) ?? [];
    if (!selectedBlocks.find((b: any) => b.id === id)) {
      const thisBlock = cs.blocks?.find((b: any) => b.id === id);
      if (thisBlock) selectedBlocks.push(thisBlock);
    }
    const selectedTracks = cs.tracks?.filter((t: any) => cs.selectedTrackIds?.includes(t.id)) ?? [];
    const selectedGroupRects = cs.groupRects?.filter((g: any) => cs.selectedGroupRectIds?.includes(g.id)) ?? [];

    const initialPositions = new Map<string, { x: number; y: number }>(
      selectedBlocks.map((b: any) => [b.id as string, { x: b.x as number, y: b.y as number }]),
    );
    const initialTrackNodes = new Map<string, { id: string; x: number; y: number }[]>(
      selectedTracks.map((t: any) => [t.id as string, t.nodes.map((n: any) => ({ ...n })) as { id: string; x: number; y: number }[]]),
    );
    const initialGroupRects = new Map<string, { x: number; y: number }>(
      selectedGroupRects.map((g: any) => [g.id as string, { x: g.x as number, y: g.y as number }]),
    );

    // Get the temporal store for undo — playground has temporal, level editor does not
    const temporalStore = (canvasStoreCtx as any)?.temporal ?? useStore.temporal;

    const handleGlobalMove = (e: PointerEvent) => {
      if (
        clickStartPosRef.current &&
        clickStartPosRef.current.pointerId !== undefined &&
        e.pointerId !== clickStartPosRef.current.pointerId
      ) {
        return;
      }
      if (
        isMobile &&
        (window as { __activeTouches?: number }).__activeTouches &&
        (window as { __activeTouches?: number }).__activeTouches! > 1
      ) {
        setIsDragging(false);
        if (hasPaused) temporalStore?.getState().resume();
        cs?.clearSelection?.();
        return;
      }

      const canvas =
        document.querySelector(".le-blocks-container canvas") ||
        document.querySelector("canvas");
      const rect = canvas
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - rect.top - camera.y) / camera.zoom;

      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;

      if (snapToGrid) {
        const snapSize = 30;
        newX = Math.round(newX / snapSize) * snapSize;
        newY = Math.round(newY / snapSize) * snapSize;
      }

      const thisInit = initialPositions.get(id);
      if (!thisInit) return;

      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;

      const currentBlock = cs.blocks?.find((sb: any) => sb.id === id);
      if (
        currentBlock &&
        thisInit.x + deltaX === currentBlock.x &&
        thisInit.y + deltaY === currentBlock.y
      ) {
        return;
      }

      const finalUpdates = selectedBlocks.map((b: any) => {
        const init = initialPositions.get(b.id)!;
        return {
          id: b.id,
          updates: { x: init.x + deltaX, y: init.y + deltaY },
        };
      });

      const trackUpdates = selectedTracks.map((t: any) => {
        const initNodes = initialTrackNodes.get(t.id)!;
        const newNodes = initNodes.map((n: any) => ({
          ...n,
          x: n.x + deltaX,
          y: n.y + deltaY,
        }));
        return { id: t.id, nodes: newNodes };
      });

      if (!hasPaused) {
        if (temporalStore) {
          temporalStore.setState((s: any) => ({
            pastStates: [
              ...s.pastStates,
              {
                blocks: cs.blocks,
                groups: cs.groups,
                groupRects: cs.groupRects,
                tracks: cs.tracks,
              },
            ],
            futureStates: [],
          }));
          temporalStore.getState().pause();
        }
        hasPaused = true;
      }

      cs?.updateBlocks?.(finalUpdates);
      trackUpdates.forEach((tu: any) => {
        cs?.updateTrack?.(tu.id, { nodes: tu.nodes });
      });
      selectedGroupRects.forEach((g: any) => {
        const init = initialGroupRects.get(g.id)!;
        cs?.updateGroupRect?.(g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
      if (hasPaused) {
        temporalStore?.getState().resume();
        if (isLevelEditor()) {
          import("../store/useLevelEditorStore").then(
            ({ useLevelEditorStore }) => {
              useLevelEditorStore.getState().commitHistory();
            },
          );
        }
      }
      if (isMobile) {
        cs?.clearSelection?.();
      }
    };

    window.addEventListener("pointermove", handleGlobalMove);
    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("pointercancel", handleGlobalUp);
    window.addEventListener("contextmenu", handleGlobalUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalMove);
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("pointercancel", handleGlobalUp);
      window.removeEventListener("contextmenu", handleGlobalUp);
    };
  }, [isDragging, dragOffset, id, isMobile]);

  return { handlePointerDown, handlePointerUp, isDragging };
};
