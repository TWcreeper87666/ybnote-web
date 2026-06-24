// components/canvas/PlayCanvas.tsx
import React, { useRef } from "react";
import * as PIXI from "pixi.js";
import { useStore } from "../../store/useStore";
import { useCanvasCamera } from "../../hooks/useCanvasCamera";
import { useCanvasInteractions } from "../../hooks/useCanvasInteractions";
import {
  useTrailIntersection,
  usePlayInteraction,
  useWheelIntercept,
} from "../../hooks/usePlayInteraction";
import { isLevelEditor } from "../../utils/routeUtils";
import { SceneRenderer } from "./SceneRenderer";

interface Block {
  id: string;
  x: number;
  y: number;
  pitch: string;
}

interface PlayCanvasProps {
  blocks: Block[];
  children?: React.ReactNode;
}

export const PlayCanvas: React.FC<PlayCanvasProps> = ({ blocks, children }) => {
  const { theme, showGrid, camera: defaultCamera, editorCamera } = useStore();
  const camera = isLevelEditor() ? editorCamera : defaultCamera;

  const containerRef = useRef<PIXI.Container>(null);
  const { activeStrokesRef, currentStrokeId, intersectedBlocksRef } =
    useCanvasInteractions();

  const checkTrailIntersection = useTrailIntersection(intersectedBlocksRef);
  usePlayInteraction("play", checkTrailIntersection, intersectedBlocksRef);

  const wheelIntercept = useWheelIntercept();
  useCanvasCamera({
    isPlayMode: true,
    isActive: true,
    onWheelIntercept: wheelIntercept,
  });

  return (
    <pixiContainer
      ref={containerRef}
      x={camera.x}
      y={camera.y}
      scale={camera.zoom}
      eventMode="static"
      sortableChildren={true}
    >
      <SceneRenderer
        showGrid={showGrid}
        theme={theme}
        zoom={camera.zoom}
        selectionBox={null}
        groupDrawBox={null}
        blocks={blocks}
        activeStrokesRef={activeStrokesRef}
        currentStrokeId={currentStrokeId}
      >
        {children}
      </SceneRenderer>
    </pixiContainer>
  );
};
