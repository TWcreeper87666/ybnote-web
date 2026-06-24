import React, { useState } from "react";
import { useStore } from "../../store/useStore";
import { useCanvasStore } from "../../store/useCanvasStore";
import { BaseGroupRect } from "./BaseGroupRect";
import type { GroupRect, Point } from "../../types";
import * as PIXI from "pixi.js";

export const GroupRectRenderer: React.FC = () => {
  const groupRects = useCanvasStore((state) => state.groupRects);
  return (
    <>
      {groupRects.map((rect) => (
        <GroupRectItem key={rect.id} rect={rect} />
      ))}
    </>
  );
};

const GroupRectItem: React.FC<{ rect: GroupRect }> = ({ rect }) => {
  const {
    selectGroupRect,
    selectedGroupRectIds,
    blocks,
    tracks,
    groupRects,
    selectedBlockIds,
    selectedTrackIds,
    updateBlocks,
    updateTrack,
    updateGroupRect,
    setHoveredGroupRectId,
    openContextMenu,
    hoveredGroupRectId,
  } = useCanvasStore(s=>s);

  const { camera, snapToGrid, showBlockVolume, showGroupName } = useStore();
  const isSelected = selectedGroupRectIds.includes(rect.id);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<string | null>(null);

  const resizeStartPosRef = React.useRef<Point | null>(null);
  const initialRectRef = React.useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const clickStartPosRef = React.useRef<Point | null>(null);
  const wasSelectedRef = React.useRef(false);
  const lastClickTimeRef = React.useRef(0);

  const handleResizeDown = (type: string, e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeType(type);
    const localX = (e.clientX - camera.x) / camera.zoom;
    const localY = (e.clientY - camera.y) / camera.zoom;
    resizeStartPosRef.current = { x: localX, y: localY };
    initialRectRef.current = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  };

  React.useEffect(() => {
    if (
      !isResizing ||
      !resizeType ||
      !initialRectRef.current ||
      !resizeStartPosRef.current
    )
      return;

    const handleGlobalMove = (e: PointerEvent) => {
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;

      const initRect = initialRectRef.current!;
      const startPos = resizeStartPosRef.current!;

      const deltaX = localX - startPos.x;
      const deltaY = localY - startPos.y;

      let newX = initRect.x;
      let newY = initRect.y;
      let newW = initRect.w;
      let newH = initRect.h;

      if (resizeType.includes("w")) {
        newX = initRect.x + deltaX;
        newW = initRect.w - deltaX;
      }
      if (resizeType.includes("e")) {
        newW = initRect.w + deltaX;
      }
      if (resizeType.includes("n")) {
        newY = initRect.y + deltaY;
        newH = initRect.h - deltaY;
      }
      if (resizeType.includes("s")) {
        newH = initRect.h + deltaY;
      }

      if (snapToGrid) {
        const snapSize = 30;
        if (resizeType.includes("w")) {
          const snappedX = Math.round(newX / snapSize) * snapSize;
          newW = newW + (newX - snappedX);
          newX = snappedX;
        }
        if (resizeType.includes("e")) {
          const snappedRight = Math.round((newX + newW) / snapSize) * snapSize;
          newW = snappedRight - newX;
        }
        if (resizeType.includes("n")) {
          const snappedY = Math.round(newY / snapSize) * snapSize;
          newH = newH + (newY - snappedY);
          newY = snappedY;
        }
        if (resizeType.includes("s")) {
          const snappedBottom = Math.round((newY + newH) / snapSize) * snapSize;
          newH = snappedBottom - newY;
        }
      }

      const MIN_SIZE = 20;
      if (newW < MIN_SIZE) {
        if (resizeType.includes("w")) newX = initRect.x + initRect.w - MIN_SIZE;
        newW = MIN_SIZE;
      }
      if (newH < MIN_SIZE) {
        if (resizeType.includes("n")) newY = initRect.y + initRect.h - MIN_SIZE;
        newH = MIN_SIZE;
      }

      updateGroupRect(rect.id, { x: newX, y: newY, w: newW, h: newH });
    };

    const handleGlobalUp = () => {
      setIsResizing(false);
      setResizeType(null);
    };

    window.addEventListener("pointermove", handleGlobalMove);
    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("pointercancel", handleGlobalUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalMove);
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("pointercancel", handleGlobalUp);
    };
  }, [isResizing, resizeType, rect.id, camera, snapToGrid, updateGroupRect]);

  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    const button = e.button;
    const isMultiSelect = e.ctrlKey || e.shiftKey;

    if (button === 0) {
      // Left click
      if (openContextMenu) {
        // closeContextMenu might not be needed here
      }
      e.stopPropagation();
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY };

      let shouldDrag: boolean;
      if (isMultiSelect) {
        selectGroupRect(rect.id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          selectGroupRect(rect.id, false);
        }
        shouldDrag = true;
      }

      if (shouldDrag) {
        setIsDragging(true);
        const pos = e.currentTarget.parent!.toLocal(e.global);
        setDragOffset({ x: pos.x - rect.x, y: pos.y - rect.y });
      }
    }
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const selectedBlocks = blocks.filter((b) =>
      selectedBlockIds.includes(b.id),
    );
    const selectedTracks = tracks.filter((t) =>
      selectedTrackIds.includes(t.id),
    );
    const selectedGroupRects = groupRects.filter((g) =>
      selectedGroupRectIds.includes(g.id),
    );
    if (!selectedGroupRects.find((g) => g.id === rect.id)) {
      const thisRect = groupRects.find((g) => g.id === rect.id);
      if (thisRect) selectedGroupRects.push(thisRect);
    }

    const initialPositions = new Map(
      selectedBlocks.map((b) => [b.id, { x: b.x, y: b.y }]),
    );
    const initialTrackNodes = new Map(
      selectedTracks.map((t) => [t.id, t.nodes.map((n) => ({ ...n }))]),
    );
    const initialGroupRects = new Map(
      selectedGroupRects.map((g) => [g.id, { x: g.x, y: g.y }]),
    );

    const handleGlobalMove = (e: PointerEvent) => {
      const localX = (e.clientX - camera.x) / camera.zoom;
      const localY = (e.clientY - camera.y) / camera.zoom;

      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;

      if (snapToGrid) {
        const snapSize = 30;
        newX = Math.round(newX / snapSize) * snapSize;
        newY = Math.round(newY / snapSize) * snapSize;
      }

      const thisInit = initialGroupRects.get(rect.id);
      if (!thisInit) return;

      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;

      const currentGroupRect = groupRects.find((sg) => sg.id === rect.id);
      if (
        currentGroupRect &&
        thisInit.x + deltaX === currentGroupRect.x &&
        thisInit.y + deltaY === currentGroupRect.y
      ) {
        return;
      }

      const finalUpdates = selectedBlocks.map((b) => {
        const init = initialPositions.get(b.id)!;
        return {
          id: b.id,
          updates: { x: init.x + deltaX, y: init.y + deltaY },
        };
      });

      const trackUpdates = selectedTracks.map((t) => {
        const initNodes = initialTrackNodes.get(t.id)!;
        const newNodes = initNodes.map((n) => ({
          ...n,
          x: n.x + deltaX,
          y: n.y + deltaY,
        }));
        return { id: t.id, nodes: newNodes };
      });

      updateBlocks(finalUpdates);
      trackUpdates.forEach((tu) => {
        updateTrack(tu.id, { nodes: tu.nodes });
      });
      selectedGroupRects.forEach((g) => {
        const init = initialGroupRects.get(g.id)!;
        updateGroupRect(g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
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
  }, [isDragging, dragOffset, rect.id, blocks, tracks, groupRects, selectedBlockIds, selectedTrackIds, selectedGroupRectIds, camera, snapToGrid, updateBlocks, updateTrack, updateGroupRect]);

  const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      const isClick = Math.hypot(dx, dy) < 5;
      if (isClick) {
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
          if (!e.ctrlKey && !e.shiftKey) {
            openContextMenu({
              x: e.clientX,
              y: e.clientY,
              blockId: `groupRect:${rect.id}`,
            });
          }
          lastClickTimeRef.current = 0;
        } else {
          lastClickTimeRef.current = now;
        }
      }
    }
  };

  const handlePointerEnter = () =>
    setHoveredGroupRectId(rect.id);
  const handlePointerLeave = () => {
    if (hoveredGroupRectId === rect.id) {
      setHoveredGroupRectId(null);
    }
  };

  return (
    <BaseGroupRect
      id={rect.id}
      x={rect.x}
      y={rect.y}
      w={rect.w}
      h={rect.h}
      name={rect.name}
      volume={rect.volume}
      isSelected={isSelected}
      showVolume={showBlockVolume}
      showGroupName={showGroupName}
      playedAt={rect.playedAt}
      enabled={rect.enabled}
      isInteractive={true}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onResizeDown={handleResizeDown}
    />
  );
};
