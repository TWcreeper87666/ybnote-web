// components/canvas/SceneRenderer.tsx
import React from "react";
import { NoteBlock } from "../blocks/NoteBlock";
import { TrackRenderer } from "../containers/TrackRenderer";
import { GroupRectRenderer } from "../containers/GroupRectRenderer";
import { TrailRenderer, type TrailStroke } from "./shared/TrailRenderer";
import { GridBackground } from "./shared/GridBackground";
import {
  SelectionBoxRenderer,
  GroupDrawBoxRenderer,
} from "./shared/SelectionBoxRenderer";
import type { Theme } from "../../types";

interface SceneRendererProps {
  showGrid: boolean;
  theme: Theme;
  zoom: number;
  selectionBox: { x: number; y: number; w: number; h: number } | null;
  groupDrawBox: { x: number; y: number; w: number; h: number } | null;
  blocks: { id: string; x: number; y: number; pitch: string }[];
  activeStrokesRef: React.RefObject<TrailStroke[]>
  currentStrokeId: React.RefObject<number> | null;
  children?: React.ReactNode;
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({
  showGrid,
  theme,
  zoom,
  selectionBox,
  groupDrawBox,
  blocks,
  activeStrokesRef,
  currentStrokeId,
  children,
}) => {
  return (
    <>
      <GridBackground showGrid={showGrid} theme={theme} zoom={zoom} />
      <SelectionBoxRenderer selectionBox={selectionBox} zoom={zoom} />
      <GroupDrawBoxRenderer groupDrawBox={groupDrawBox} zoom={zoom} />
      <GroupRectRenderer />

      {blocks.map((block) => (
        <NoteBlock
          key={block.id}
          id={block.id}
          x={block.x}
          y={block.y}
          pitch={block.pitch}
        />
      ))}

      <TrackRenderer />
      <TrailRenderer
        activeStrokesRef={activeStrokesRef}
        currentStrokeId={currentStrokeId}
      />
      {children}
    </>
  );
};
