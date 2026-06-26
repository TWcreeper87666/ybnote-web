import React, { useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useCanvasContext } from '../canvas/CanvasContext';
import { getCanvasAdapter } from '../../store/canvasAdapter';
import {
  getBlocksForContext, getCameraForContext, updateBlocksInContext, commitContextHistory,
  useActiveCanvasGroupRects, useActiveCanvasSelectedGroupRectIds,
  getGroupRectsForContext, getSelectedGroupRectIdsForContext, getSelectedBlockIdsForContext, getSelectedTrackIdsForContext, getTracksForContext,
  updateGroupRectInContext, selectGroupRectInContext, openContextMenuInContext, closeContextMenuInContext,
  setHoveredGroupRectIdInContext, updateTrackInContext,
} from '../../hooks/useActiveCanvas';
import { BaseGroupRect } from './BaseGroupRect';
import type { GroupRect } from '../../types';
import * as PIXI from 'pixi.js';
import { getCanvasContainerRect, snapValue } from '../../utils/canvasUtils';
import { createDragHistoryGuard } from '../../utils/dragUtils';
import { useDoubleClick } from '../../hooks/useDoubleClick';

export const GroupRectRenderer: React.FC = () => {
  const groupRects = useActiveCanvasGroupRects();
  return (
    <>
      {groupRects.map(rect => (
        <GroupRectItem key={rect.id} rect={rect} />
      ))}
    </>
  );
};

const GroupRectItem: React.FC<{ rect: GroupRect }> = ({ rect }) => {
  const canvasContext = useCanvasContext();
  const selectedGroupRectIds = useActiveCanvasSelectedGroupRectIds();
  const isSelected = selectedGroupRectIds.includes(rect.id);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<string | null>(null);

  const resizeStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const initialRectRef = React.useRef<{x: number, y: number, w: number, h: number} | null>(null);
  const clickStartPosRef = React.useRef<{x: number, y: number} | null>(null);
  const wasSelectedRef = React.useRef(false);
  const { isDoubleClick } = useDoubleClick();

  const showBlockVolume = useSettingsStore(state => state.showBlockVolume);
  const showGroupName = useSettingsStore(state => state.showGroupName);




  const handleResizeDown = (type: string, e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeType(type);
    const camera = getCameraForContext(canvasContext);
    const localX = (e.clientX - camera.x) / camera.zoom;
    const localY = (e.clientY - camera.y) / camera.zoom;
    resizeStartPosRef.current = { x: localX, y: localY };
    initialRectRef.current = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  };

  React.useEffect(() => {
    if (!isResizing || !resizeType || !initialRectRef.current || !resizeStartPosRef.current) return;

    const adapter = getCanvasAdapter(canvasContext);
    const historyGuard = createDragHistoryGuard(adapter);
    const handleGlobalMove = (e: PointerEvent) => {
      const camera = getCameraForContext(canvasContext);

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

      if (resizeType.includes('w')) {
        newX = initRect.x + deltaX;
        newW = initRect.w - deltaX;
      }
      if (resizeType.includes('e')) {
        newW = initRect.w + deltaX;
      }
      if (resizeType.includes('n')) {
        newY = initRect.y + deltaY;
        newH = initRect.h - deltaY;
      }
      if (resizeType.includes('s')) {
        newH = initRect.h + deltaY;
      }

      if (useSettingsStore.getState().snapToGrid) {
        if (resizeType.includes('w')) {
          const snappedX = snapValue(newX);
          newW = newW + (newX - snappedX);
          newX = snappedX;
        }
        if (resizeType.includes('e')) {
          newW = snapValue(newX + newW) - newX;
        }
        if (resizeType.includes('n')) {
          const snappedY = snapValue(newY);
          newH = newH + (newY - snappedY);
          newY = snappedY;
        }
        if (resizeType.includes('s')) {
          newH = snapValue(newY + newH) - newY;
        }
      }

      const MIN_SIZE = 20;
      if (newW < MIN_SIZE) {
        if (resizeType.includes('w')) newX = initRect.x + initRect.w - MIN_SIZE;
        newW = MIN_SIZE;
      }
      if (newH < MIN_SIZE) {
        if (resizeType.includes('n')) newY = initRect.y + initRect.h - MIN_SIZE;
        newH = MIN_SIZE;
      }

      historyGuard.onMove();
      updateGroupRectInContext(canvasContext, rect.id, { x: newX, y: newY, w: newW, h: newH });
    };

    const handleGlobalUp = () => {
      setIsResizing(false);
      setResizeType(null);
      historyGuard.onUp();
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [isResizing, resizeType, rect.id]);

  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    const button = e.button;
    const isMultiSelect = e.ctrlKey || e.shiftKey;

    if (button === 0) { // Left click
      const ctxMenu = getCanvasAdapter(canvasContext).getContextMenu();
      if (ctxMenu && ctxMenu.blockId !== `groupRect:${rect.id}`) {
        closeContextMenuInContext(canvasContext);
      }
      e.stopPropagation();
      wasSelectedRef.current = isSelected;
      clickStartPosRef.current = { x: e.clientX, y: e.clientY };

      let shouldDrag: boolean;
      if (isMultiSelect) {
        selectGroupRectInContext(canvasContext, rect.id, true);
        shouldDrag = !isSelected;
      } else {
        if (!isSelected) {
          selectGroupRectInContext(canvasContext, rect.id, false);
        }
        // Allow drag even if already selected (deselect/solo handled on pointerUp if no drag)
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

    const adapter = getCanvasAdapter(canvasContext);
    const historyGuard = createDragHistoryGuard(adapter);
    const selectedBlockIds = getSelectedBlockIdsForContext(canvasContext);
    const selectedTrackIds = getSelectedTrackIdsForContext(canvasContext);
    const ctxGroupRects = getGroupRectsForContext(canvasContext);
    const ctxSelectedGroupRectIds = getSelectedGroupRectIdsForContext(canvasContext);
    const selectedBlocks = getBlocksForContext(canvasContext).filter(b => selectedBlockIds.includes(b.id));
    const selectedTracks = getTracksForContext(canvasContext).filter(t => selectedTrackIds.includes(t.id));
    const selectedGroupRects = ctxGroupRects.filter(g => ctxSelectedGroupRectIds.includes(g.id));
    if (!selectedGroupRects.find(g => g.id === rect.id)) {
      const thisRect = ctxGroupRects.find(g => g.id === rect.id);
      if (thisRect) selectedGroupRects.push(thisRect);
    }

    const initialPositions = new Map(selectedBlocks.map(b => [b.id, { x: b.x, y: b.y }]));
    const initialTrackNodes = new Map(selectedTracks.map(t => [t.id, t.nodes.map(n => ({...n}))]));
    const initialGroupRects = new Map(selectedGroupRects.map(g => [g.id, { x: g.x, y: g.y }]));

    const handleGlobalMove = (e: PointerEvent) => {
      const camera = getCameraForContext(canvasContext);
      const canvasRect = getCanvasContainerRect(canvasContext);

      const localX = (e.clientX - canvasRect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - canvasRect.top - camera.y) / camera.zoom;

      let newX = localX - dragOffset.x;
      let newY = localY - dragOffset.y;

      if (useSettingsStore.getState().snapToGrid) {
        newX = snapValue(newX);
        newY = snapValue(newY);
      }

      const thisInit = initialGroupRects.get(rect.id);
      if (!thisInit) return;

      const deltaX = newX - thisInit.x;
      const deltaY = newY - thisInit.y;

      const currentGroupRect = getGroupRectsForContext(canvasContext).find(sg => sg.id === rect.id);
      if (currentGroupRect && (thisInit.x + deltaX) === currentGroupRect.x && (thisInit.y + deltaY) === currentGroupRect.y) {
        return;
      }

      const finalUpdates = selectedBlocks.map(b => {
        const init = initialPositions.get(b.id)!;
        return { id: b.id, updates: { x: init.x + deltaX, y: init.y + deltaY } };
      });

      const trackUpdates = selectedTracks.map(t => {
        const initNodes = initialTrackNodes.get(t.id)!;
        const newNodes = initNodes.map(n => ({ ...n, x: n.x + deltaX, y: n.y + deltaY }));
        return { id: t.id, nodes: newNodes };
      });

      historyGuard.onMove();
      updateBlocksInContext(canvasContext, finalUpdates);
      trackUpdates.forEach(tu => {
        updateTrackInContext(canvasContext, tu.id, { nodes: tu.nodes });
      });
      selectedGroupRects.forEach(g => {
        const init = initialGroupRects.get(g.id)!;
        updateGroupRectInContext(canvasContext, g.id, { x: init.x + deltaX, y: init.y + deltaY });
      });
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
      historyGuard.onUp();
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    window.addEventListener('contextmenu', handleGlobalUp);
    
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      window.removeEventListener('contextmenu', handleGlobalUp);
    };
  }, [isDragging, dragOffset, rect.id]);

  const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
    if (e.button === 0 && clickStartPosRef.current) {
      const dx = e.clientX - clickStartPosRef.current.x;
      const dy = e.clientY - clickStartPosRef.current.y;
      const isClick = Math.hypot(dx, dy) < 5;
      if (isClick && isDoubleClick()) {
        if (!e.ctrlKey && !e.shiftKey) {
          openContextMenuInContext(canvasContext, {
            x: e.clientX, y: e.clientY, blockId: `groupRect:${rect.id}`
          });
        }
      }
    }
  };

  const handlePointerEnter = () => setHoveredGroupRectIdInContext(canvasContext, rect.id);
  const handlePointerLeave = () => setHoveredGroupRectIdInContext(canvasContext, null);

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
