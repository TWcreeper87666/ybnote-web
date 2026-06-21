import React, { useCallback } from 'react';
import * as PIXI from 'pixi.js';

interface GridBackgroundProps {
  showGrid: boolean;
  theme: string;
  zoom: number;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({ showGrid, theme, zoom }) => {
  const drawBackground = useCallback((g: PIXI.Graphics) => {
    g.clear();
    // Hit area covering the whole screen so we can detect drag anywhere
    g.rect(-10000, -10000, 20000, 20000); 
    g.fill({ color: 0x000000, alpha: 0.001 }); // Almost transparent

    // Draw grid if enabled
    if (showGrid) {
      const isDark = theme === 'dark';
      const gridColor = isDark ? 0xffffff : 0x000000;
      const gridAlpha = isDark ? 0.1 : 0.05;
      
      const gridSize = 60;
      const size = 5000;
      const startPos = Math.floor(-size / gridSize) * gridSize;
      const endPos = Math.ceil(size / gridSize) * gridSize;
      
      // Optimizing grid display when zoomed out
      const step = zoom < 0.3 ? gridSize * 4 : (zoom < 0.6 ? gridSize * 2 : gridSize);

      for (let x = startPos; x <= endPos; x += step) {
        g.moveTo(x, startPos);
        g.lineTo(x, endPos);
      }
      for (let y = startPos; y <= endPos; y += step) {
        g.moveTo(startPos, y);
        g.lineTo(endPos, y);
      }
      
      g.stroke({ width: 1 / zoom, color: gridColor, alpha: gridAlpha });
    }
  }, [theme, showGrid, zoom]);

  return <pixiGraphics label="background" zIndex={-10} draw={drawBackground} eventMode="static" />;
};
