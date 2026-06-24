import React, { useEffect, useState, useContext } from 'react';
import { useStore } from '../../store/useStore';
import { CanvasStoreContext } from '../../store/CanvasStoreContext';
import { useSettingsStore } from '../../store';
import { getPitchColorNumber } from '../../utils/colors';

export const PocketDragOverlay: React.FC = () => {
  const activePocketDrag = useStore(state => state.activePocketDrag);
  const mainCameraZoom = useStore(state => state.camera.zoom);
  const pocketCameraZoom = useStore(state => state.pocketCamera.zoom);
  const { snapToGrid, pianoKeysCount } = useSettingsStore();
  const canvasStoreCtx = useContext(CanvasStoreContext);

  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [isInsidePocket, setIsInsidePocket] = useState(true);

  useEffect(() => {
    if (!activePocketDrag) return;

    const handleMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      const pocketContainer = document.querySelector('.pocket-canvas-container');
      if (pocketContainer) {
        const rect = pocketContainer.getBoundingClientRect();
        setIsInsidePocket(
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        );
      }
    };

    const handleUp = (e: PointerEvent) => {
      const state = useStore.getState();
      const dragState = state.activePocketDrag;

      if (dragState) {
        // Check if inside pocket canvas
        const pocketContainer = document.querySelector('.pocket-canvas-container');
        if (pocketContainer) {
          const pocketRect = pocketContainer.getBoundingClientRect();
          if (e.clientX >= pocketRect.left && e.clientX <= pocketRect.right &&
              e.clientY >= pocketRect.top && e.clientY <= pocketRect.bottom) {
             state.setActivePocketDrag(null);
             return;
          }
        }

        // Use canvas context store for camera and block creation if available
        const cs = canvasStoreCtx?.getState() as any ?? state;
        const camera = cs.camera;

        const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('.main-wrapper canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };

        const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const localY = (e.clientY - rect.top - camera.y) / camera.zoom;

        const primaryBlockX = localX - dragState.offsetX;
        const primaryBlockY = localY - dragState.offsetY;

        let finalX = primaryBlockX;
        let finalY = primaryBlockY;
        if (snapToGrid) {
            const snapSize = 30;
            finalX = Math.round(finalX / snapSize) * snapSize;
            finalY = Math.round(finalY / snapSize) * snapSize;
        }

        const primaryBlock = dragState.blocks.find(b => b.id === dragState.clickedBlockId) || dragState.blocks[0];

        const newBlocks = dragState.blocks.map(b => {
            const relX = ((b as unknown as {xOffset: number}).xOffset - (primaryBlock as unknown as {xOffset: number}).xOffset);
            const relY = ((b as unknown as {yOffset: number}).yOffset - (primaryBlock as unknown as {yOffset: number}).yOffset);
            return {
                ...b,
                id: Math.random().toString(36).substring(2, 9),
                x: finalX + relX,
                y: finalY + relY,
                groupId: undefined
            };
        });

        if (state.gameState === 'arrange') {
            state.setGameState('arrange');
            state.setGameBlocks([...state.gameBlocks, ...newBlocks]);
            state.clearSelection();
            newBlocks.forEach(b => state.selectBlock(b.id, true));
        } else {
            // Add to canvas context store (playground store)
            const addedIds = cs.addBlocks?.(newBlocks) ?? [];
            cs.clearSelection?.();
            addedIds.forEach((id: string) => cs.selectBlock?.(id, true));
        }
      }

      state.setActivePocketDrag(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setMousePos(null);
    };
  }, [activePocketDrag, canvasStoreCtx, snapToGrid]);

  if (!activePocketDrag) return null;

  // Use canvas context store zoom for main canvas if available
  const cs = canvasStoreCtx?.getState() as any;
  const effectiveMainZoom = cs?.camera?.zoom ?? mainCameraZoom;
  const zoom = isInsidePocket ? pocketCameraZoom : effectiveMainZoom;
  const size = 60 * zoom;

  const displayX = mousePos ? mousePos.x : (activePocketDrag.initialX || 0);
  const displayY = mousePos ? mousePos.y : (activePocketDrag.initialY || 0);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999 }}>
      {activePocketDrag.blocks.map(block => {
        const primary = activePocketDrag.blocks.find(b => b.id === activePocketDrag.clickedBlockId) || activePocketDrag.blocks[0];
        const relX = ((block as unknown as {xOffset: number}).xOffset - (primary as unknown as {xOffset: number}).xOffset) * zoom;
        const relY = ((block as unknown as {yOffset: number}).yOffset - (primary as unknown as {yOffset: number}).yOffset) * zoom;

        const left = displayX - (activePocketDrag.offsetX * zoom) + relX;
        const top = displayY - (activePocketDrag.offsetY * zoom) + relY;

        const colorNum = getPitchColorNumber(block.pitch, pianoKeysCount);
        const hexColor = '#' + colorNum.toString(16).padStart(6, '0');

        return (
          <div key={block.id} style={{
            position: 'absolute',
            left, top,
            width: size, height: size,
            backgroundColor: hexColor,
            opacity: 0.7,
            borderRadius: 12 * zoom,
            border: `${3 * Math.max(1, zoom)}px solid #4f46e5`,
            boxShadow: `0 0 0 ${4 * zoom}px rgba(99, 102, 241, 0.5)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: `${14 * zoom}px`,
            textShadow: `0px ${1 * zoom}px ${2 * zoom}px rgba(0,0,0,0.5)`,
            transition: 'width 0.2s ease, height 0.2s ease, border-radius 0.2s ease, border-width 0.2s ease, box-shadow 0.2s ease, font-size 0.2s ease, text-shadow 0.2s ease'
          }}>
             {zoom > 0.5 && block.pitch}
          </div>
        );
      })}
    </div>
  );
};
