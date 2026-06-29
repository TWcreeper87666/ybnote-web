import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { useCanvasContext } from '../canvas/CanvasContext';
import { addBlocksToContext } from '../../hooks/useActiveCanvas';
import { getCanvasAdapter } from '../../store/canvasAdapter';
import { getPitchColorNumber } from '../../utils/colors';
import { snapValue } from '../../utils/canvasUtils';

export const PocketDragOverlay: React.FC = () => {
  const canvasContext = useCanvasContext();
  const activePocketDrag = useStore(state => state.activePocketDrag);
  const pianoKeysCount = useSettingsStore(state => state.pianoKeysCount);
  const playgroundCameraZoom = useStore(state => state.camera.zoom);
  const editorCameraZoom = useLevelEditorStore(state => state.camera.zoom);
  const mainCameraZoom = canvasContext === 'editor' ? editorCameraZoom : playgroundCameraZoom;
  const pocketCameraZoom = useStore(state => state.pocketCamera.zoom);
  
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
        const pocketContainer = document.querySelector('.pocket-canvas-container');
        if (pocketContainer) {
          const pocketRect = pocketContainer.getBoundingClientRect();
          if (e.clientX >= pocketRect.left && e.clientX <= pocketRect.right &&
              e.clientY >= pocketRect.top && e.clientY <= pocketRect.bottom) {
             state.setActivePocketDrag(null);
             return;
          }
        }

        const camera = getCanvasAdapter(canvasContext).getCamera();
        const canvas = document.querySelector('.le-blocks-container canvas') || document.querySelector('.main-wrapper canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        
        const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const localY = (e.clientY - rect.top - camera.y) / camera.zoom;

        let finalX = localX - 30;
        let finalY = localY - 30;
        if (useSettingsStore.getState().snapToGrid) {
            finalX = snapValue(finalX);
            finalY = snapValue(finalY);
        }

        const primaryBlock = dragState.blocks.find(b => b.id === dragState.clickedBlockId) || dragState.blocks[0];

        const newBlocks = dragState.blocks.map(b => {
            const relX = (b as unknown as {xOffset: number}).xOffset - (primaryBlock as unknown as {xOffset: number}).xOffset;
            const relY = (b as unknown as {yOffset: number}).yOffset - (primaryBlock as unknown as {yOffset: number}).yOffset;
            return {
                ...b,
                id: Math.random().toString(36).substring(2, 9),
                x: finalX + relX,
                y: finalY + relY,
                groupId: undefined
            };
        });

        const addedIds = addBlocksToContext(canvasContext, newBlocks);
        const adapter = getCanvasAdapter(canvasContext);
        adapter.clearSelection();
        addedIds.forEach(id => adapter.selectBlock(id, true));
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
  }, [activePocketDrag, canvasContext]);

  if (!activePocketDrag) return null;

  // Match KeyboardDragOverlay: scale with CSS transform, fixed 60×60 block
  const currentZoom = isInsidePocket ? pocketCameraZoom : mainCameraZoom;

  const displayX = mousePos ? mousePos.x : (activePocketDrag.initialX || 0);
  const displayY = mousePos ? mousePos.y : (activePocketDrag.initialY || 0);

  const primary = activePocketDrag.blocks.find(b => b.id === activePocketDrag.clickedBlockId) || activePocketDrag.blocks[0];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9999 }}>
      {activePocketDrag.blocks.map(block => {
        // Relative offset in pocket canvas units → scale to screen pixels using currentZoom
        // so the spacing always matches the visual scale (transform: scale also uses currentZoom)
        const relX = ((block as unknown as {xOffset: number}).xOffset - (primary as unknown as {xOffset: number}).xOffset) * currentZoom;
        const relY = ((block as unknown as {yOffset: number}).yOffset - (primary as unknown as {yOffset: number}).yOffset) * currentZoom;

        // Primary block centered on cursor; others offset by their pocket-space distance
        const left = displayX - 30 + relX;
        const top = displayY - 30 + relY;

        const colorNum = getPitchColorNumber(block.pitch, pianoKeysCount);
        const hexColor = '#' + colorNum.toString(16).padStart(6, '0');
        const isDrum = block.instrument === 'percussion';

        return (
          <div key={block.id} style={{
            position: 'absolute',
            left, top,
            width: 60,
            height: 60,
            backgroundColor: hexColor,
            opacity: 0.7,
            borderRadius: isDrum ? '50%' : 12,
            border: `3px solid #4f46e5`,
            boxShadow: `0 0 0 4px rgba(99, 102, 241, 0.5)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 14,
            textShadow: `0px 1px 2px rgba(0,0,0,0.5)`,
            transform: `scale(${currentZoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }}>
            {currentZoom > 0.5 && block.pitch}
          </div>
        );
      })}
    </div>
  );
};