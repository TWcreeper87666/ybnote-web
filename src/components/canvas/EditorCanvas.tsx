// components/canvas/EditorCanvas.tsx
import React, { useRef } from "react";
import * as PIXI from "pixi.js";
import { useEditorInteraction } from "../../hooks/useEditorInteraction";
import { useTrailIntersection } from "../../hooks/usePlayInteraction";
import { SceneRenderer } from "./SceneRenderer";
import type { CameraState, Point, Theme } from "../../types";
import type { TrailStroke } from "./shared/TrailRenderer";
import { Application } from "@pixi/react";

interface EditorCanvasProps {
  camera: { x: number; y: number; zoom: number };
  blocks: { id: string; x: number; y: number; pitch: string }[];
  theme: Theme;
  showGrid: boolean;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  activeStrokesRef: React.RefObject<TrailStroke[]>;
  currentStrokeId: React.RefObject<number | null>;
  intersectedBlocksRef: React.RefObject<Set<string>>;
  interactions: {
    startPan: (x: number, y: number, camX: number, camY: number) => void;
    updatePan: (
      x: number,
      y: number,
      updateCamera: (camera: Partial<CameraState>) => void,
    ) => boolean;
    endPan: () => void;
    startSelection: (x: number, y: number) => void;
    updateSelection: (
      x: number,
      y: number,
    ) => { x: number; y: number; w: number; h: number } | null;
    endSelection: () => void;
    startTrail: (x: number, y: number) => void;
    updateTrail: (
      x: number,
      y: number,
      cb: (p1: Point, p2: Point) => void,
    ) => void;
    isSelectingRef: React.RefObject<boolean>;
  };
  children?: React.ReactNode;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  camera,
  blocks,
  theme,
  showGrid,
  selectionBox,
  activeStrokesRef,
  currentStrokeId,
  intersectedBlocksRef,
  interactions,
  children,
}) => {
  const containerRef = useRef<PIXI.Container>(null);
  const checkTrailIntersection = useTrailIntersection(intersectedBlocksRef);

  const editorInteraction = useEditorInteraction(
    camera,
    interactions,
    checkTrailIntersection,
    intersectedBlocksRef,
  );

  return (
    <Application backgroundAlpha={0} resizeTo={window} antialias={true}>
      <pixiContainer
        ref={containerRef}
        x={camera.x}
        y={camera.y}
        scale={camera.zoom}
        eventMode="static"
        sortableChildren={true}
        onPointerDown={editorInteraction.onPointerDown}
        onPointerMove={editorInteraction.onPointerMove}
        onPointerUp={editorInteraction.onPointerUp}
        onPointerUpOutside={editorInteraction.onPointerUp}
      >
        <SceneRenderer
          showGrid={showGrid}
          theme={theme}
          zoom={camera.zoom}
          selectionBox={selectionBox}
          groupDrawBox={editorInteraction.groupDrawBox}
          blocks={blocks}
          activeStrokesRef={activeStrokesRef}
          currentStrokeId={currentStrokeId}
        >
          {children}
        </SceneRenderer>
      </pixiContainer>
    </Application>
  );
};
