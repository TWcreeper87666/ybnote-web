import React, { useCallback } from 'react';
import * as PIXI from 'pixi.js';

interface SelectionBoxRendererProps {
  selectionBox: { x: number, y: number, w: number, h: number } | null;
  zoom: number;
  color?: number;
  alpha?: number;
}

export const SelectionBoxRenderer: React.FC<SelectionBoxRendererProps> = ({ 
  selectionBox, 
  zoom,
  color = 0x6366f1,
  alpha = 0.2
}) => {
  const drawSelectionBox = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (selectionBox) {
      g.rect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      g.fill({ color, alpha });
      g.stroke({ width: 1 / zoom, color, alpha: 0.8 });
    }
  }, [selectionBox, zoom, color, alpha]);

  return <pixiGraphics zIndex={200} draw={drawSelectionBox} eventMode="none" />;
};

interface GroupDrawBoxRendererProps {
  groupDrawBox: { x: number, y: number, w: number, h: number } | null;
  zoom: number;
}

export const GroupDrawBoxRenderer: React.FC<GroupDrawBoxRendererProps> = ({ groupDrawBox, zoom }) => {
  const drawGroupDrawBox = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (groupDrawBox) {
      g.roundRect(groupDrawBox.x, groupDrawBox.y, groupDrawBox.w, groupDrawBox.h, 8);
      g.fill({ color: 0x4f46e5, alpha: 0.15 });
      g.stroke({ width: 2 / zoom, color: 0x6366f1, alpha: 0.5 });
    }
  }, [groupDrawBox, zoom]);

  return <pixiGraphics zIndex={200} draw={drawGroupDrawBox} eventMode="none" />;
};
