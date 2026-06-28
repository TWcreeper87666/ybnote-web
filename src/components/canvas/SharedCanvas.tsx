import React, { useRef } from 'react';
import { Application } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { useStore } from '../../store/useStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { GroupRectRenderer } from '../containers/GroupRectRenderer';
import { useCanvasCamera } from '../../hooks/useCanvasCamera';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { tryReleasePointerCapture } from '../../utils/canvasUtils';
import { shiftPitch } from '../../utils/pitchUtils';
import { CanvasProvider } from '../../store/CanvasProvider';
import { getCanvasState } from '../../store/canvasAdapter';
import { useTrailTool } from './tools/useTrailTool';
import { useDrawGroupTool } from './tools/useDrawGroupTool';
import { useDrawTrackTool } from './tools/useDrawTrackTool';
import { useSpawnTool } from './tools/useSpawnTool';
import { useSelectTool } from './tools/useSelectTool';
import { usePlayTool } from './tools/usePlayTool';
import { useCameraTool } from './tools/useCameraTool';
import { BlockLayer } from './layers/BlockLayer';
import { GridLayer } from './layers/GridLayer';
import { SelectionLayer } from './layers/SelectionLayer';
import { TrailLayer } from './layers/TrailLayer';
import { TrackLayer } from './layers/TrackLayer';
import { OverlayLayer } from './layers/OverlayLayer';

interface SharedCanvasProps {
  context: 'playground' | 'editor';
}

export const SharedCanvas: React.FC<SharedCanvasProps> = ({ context }) => {
  const { mode, latestPerformHit } = useStore();

  const playgroundCamera = useStore(s => s.camera);
  const editorCamera = useLevelEditorStore(s => s.camera);
  const camera = context === 'editor' ? editorCamera : playgroundCamera;

  const containerRef = useRef<PIXI.Container>(null);

  const {
    startPan, updatePan, endPan,
    selectionBox, startSelection, updateSelection, endSelection,
    activeStrokesRef, currentStrokeId, startTrail, updateTrail, endTrail,
    intersectedBlocksRef, isSelectingRef,
  } = useCanvasInteractions();

  // ── Tools ──────────────────────────────────────────────────────────────────
  const trail = useTrailTool(context, { intersectedBlocksRef, startTrail, updateTrail, endTrail });
  const drawGroup = useDrawGroupTool(context);
  const drawTrack = useDrawTrackTool(context);
  const spawn = useSpawnTool(context);
  const select = useSelectTool(context, { isSelectingRef, startSelection, updateSelection, endSelection });
  const cameraTool = useCameraTool(context, { startPan, updatePan, endPan });
  usePlayTool(context, { checkIntersection: trail.checkIntersection, intersectedBlocksRef });

  // ── Scroll-wheel pitch / volume / zoom ─────────────────────────────────────
  useCanvasCamera({
    isPlayMode: mode === 'play',
    isActive: true,
    isEditorCanvas: context === 'editor',
    onWheelIntercept: React.useCallback((e: WheelEvent) => {
      const canvas = getCanvasState(context);
      if (useStore.getState().mode === 'play') return false;
      if (context === 'editor' && useLevelEditorStore.getState().activeTab === 'charting') return false;

      let targetBlockId = canvas.hoveredBlockId;
      let targetGroupRectId = canvas.hoveredGroupRectId;

      if (!targetBlockId && !targetGroupRectId) {
        const localX = (e.clientX - canvas.camera.x) / canvas.camera.zoom;
        const localY = (e.clientY - canvas.camera.y) / canvas.camera.zoom;
        for (let i = canvas.blocks.length - 1; i >= 0; i--) {
          const b = canvas.blocks[i];
          if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) { targetBlockId = b.id; break; }
        }
        if (!targetBlockId) {
          for (let i = canvas.groupRects.length - 1; i >= 0; i--) {
            const g = canvas.groupRects[i];
            if (localX >= g.x && localX <= g.x + g.w && localY >= g.y && localY <= g.y + g.h) { targetGroupRectId = g.id; break; }
          }
        }
      }

      if (targetBlockId && !e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        if (context === 'playground') {
          useStore.getState().mutateBlocks(
            [targetBlockId],
            (b) => e.shiftKey
              ? { volume: Math.round(Math.max(0, Math.min(1, (b.volume ?? 1) + delta * 0.1)) * 100) / 100, playedAt: Date.now(), playedVolumeMultiplier: 1 }
              : { pitch: shiftPitch(b.pitch, delta), playedAt: Date.now(), playedVolumeMultiplier: 1 },
            { continuous: true }
          );
        } else {
          const block = canvas.blocks.find(b => b.id === targetBlockId);
          if (block) {
            canvas.updateBlock(block.id, e.shiftKey
              ? { volume: Math.round(Math.max(0, Math.min(1, (block.volume ?? 1) + delta * 0.1)) * 100) / 100, playedAt: Date.now(), playedVolumeMultiplier: 1 }
              : { pitch: shiftPitch(block.pitch, delta), playedAt: Date.now(), playedVolumeMultiplier: 1 }
            );
          }
        }
        return true;
      }
      if (targetGroupRectId && !e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        const rect = canvas.groupRects.find(g => g.id === targetGroupRectId);
        if (rect) {
          canvas.updateGroupRect(rect.id, { volume: Math.round(Math.max(0, Math.min(1, (rect.volume ?? 1) + (e.deltaY > 0 ? -1 : 1) * 0.1)) * 100) / 100 });
        }
        return true;
      }
      return false;
    }, [context])
  });

  // ── Pixi pointer handlers ───────────────────────────────────────────────────
  const handlePointerDown = (e: PIXI.FederatedPointerEvent) => {
    useStore.getState().setInteractionContext('main');
    if (useStore.getState().mode === 'play') return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    if (cameraTool.onPointerDown(e)) return;
    if (e.button === 2) { trail.onPointerDown(e); return; }

    const sharedMode = useStore.getState().mode;
    if (sharedMode === 'draw_track') { drawTrack.onPointerDown(e); return; }
    if (sharedMode === 'draw_group') { drawGroup.onPointerDown(e); return; }

    if (!spawn.onPointerDown(e)) select.onPointerDown(e);
  };

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
    if (useStore.getState().mode === 'play') return;
    cameraTool.onPointerMove(e)
      || drawGroup.onPointerMove(e)
      || select.onPointerMove(e)
      || trail.onPointerMove(e);
  };

  const handlePointerUp = (e: PIXI.FederatedPointerEvent) => {
    cameraTool.onPointerUp();
    trail.onPointerUp();
    drawGroup.onPointerUp();
    select.onPointerUp();
    tryReleasePointerCapture(e.target, e.pointerId);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const content = (
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
          <GridLayer context={context} />
          <SelectionLayer selectionBox={selectionBox} groupDrawBox={drawGroup.groupDrawBox} zoom={camera.zoom} />
          <GroupRectRenderer />
          <TrackLayer onNodeDeletedByDrag={() => {
            activeStrokesRef.current = activeStrokesRef.current.filter(s => s.id !== currentStrokeId.current);
            endTrail();
          }} />
          <BlockLayer context={context} />
          <TrailLayer activeStrokesRef={activeStrokesRef} currentStrokeId={currentStrokeId} />
        </pixiContainer>
      </Application>

      <OverlayLayer mode={mode} latestPerformHit={latestPerformHit} />
    </div>
  );

  if (context === 'editor') return <CanvasProvider type="editor">{content}</CanvasProvider>;
  return content;
};
