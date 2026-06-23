import React, { useCallback, useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';

export interface BaseGroupRectProps {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  volume?: number;
  isSelected?: boolean;
  enabled?: boolean;
  showVolume: boolean;
  showGroupName: boolean;
  playedAt?: number;
  isInteractive?: boolean;
  onPointerDown?: (e: PIXI.FederatedPointerEvent) => void;
  onPointerUp?: (e: PIXI.FederatedPointerEvent) => void;
  onPointerEnter?: (e: PIXI.FederatedPointerEvent) => void;
  onPointerLeave?: (e: PIXI.FederatedPointerEvent) => void;
  onResizeDown?: (type: string, e: PIXI.FederatedPointerEvent) => void;
}

export const BaseGroupRect: React.FC<BaseGroupRectProps> = ({
  x, y, w, h, name, volume, isSelected = false, enabled = true,
  showVolume, showGroupName, playedAt, isInteractive = true,
  onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onResizeDown
}) => {
  const graphicsRef = useRef<PIXI.Graphics>(null);
  const ripplesRef = useRef<{id: number, progress: number}[]>([]);
  const lastPlayedRef = useRef(playedAt || 0);

  useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      if (Date.now() - playedAt < 2000) {
        ripplesRef.current.push({ id: playedAt, progress: 0 });
      }
      lastPlayedRef.current = playedAt;
    }
  }, [playedAt]);

  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();

    const isEnabled = enabled !== false;
    const baseAlpha = isEnabled ? 1 : 0.3;

    // Draw ripples
    ripplesRef.current.forEach(r => {
      const expansion = r.progress * 40; 
      const alpha = 1 - r.progress; 
      g.roundRect(x - expansion, y - expansion, w + expansion * 2, h + expansion * 2, 8);
      g.stroke({ width: 4, color: isEnabled ? 0x8b5cf6 : 0x6b7280, alpha: alpha * baseAlpha });
    });

    // Selected outline glow
    if (isSelected) {
      g.roundRect(x - 4, y - 4, w + 8, h + 8, 10);
      g.fill({ color: isEnabled ? 0x6366f1 : 0x9ca3af, alpha: 0.3 * baseAlpha }); // Indigo glow
      g.stroke({ width: 3, color: isEnabled ? 0x4f46e5 : 0x6b7280, alpha: 0.8 * baseAlpha });
    } else {
      // Default border
      g.roundRect(x, y, w, h, 8);
      g.stroke({ width: 2, color: 0xffffff, alpha: 0.2 * baseAlpha });
    }

    g.roundRect(x, y, w, h, 8);
    g.fill({ color: 0xffffff, alpha: 0.05 * baseAlpha });

    if (showVolume) {
      const barW = Math.max(52, Math.min(100, w - 16));
      const currentVol = volume ?? 1;
      const volAlpha = isSelected ? 1 : 0.5;
      if (barW > 0) {
        g.roundRect(x + 8, y + h - 14, barW, 6, 3);
        g.fill({ color: 0x000000, alpha: 0.3 * volAlpha * baseAlpha });
        g.roundRect(x + 8, y + h - 14, barW * currentVol, 6, 3);
        g.fill({ color: 0xffffff, alpha: 0.8 * volAlpha * baseAlpha });
      }
    }
  }, [x, y, w, h, isSelected, volume, showVolume, enabled]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const tick = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      
      if (ripplesRef.current.length > 0) {
        ripplesRef.current.forEach(r => r.progress += delta * 2.0);
        ripplesRef.current = ripplesRef.current.filter(r => r.progress < 1);
        if (graphicsRef.current) {
          draw(graphicsRef.current);
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };
    
    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw]);

  useEffect(() => {
    if (graphicsRef.current) {
      graphicsRef.current.hitArea = new PIXI.Rectangle(x, y, w, h);
    }
  }, [x, y, w, h]);

  const handleDrawHandle = useCallback((g: PIXI.Graphics, w: number, h: number) => {
    g.clear();
    g.rect(0, 0, w, h);
    g.fill({ color: 0x000000, alpha: 0.001 }); // invisible but interactive
  }, []);

  const m = 16;
  const handles = [
    { type: 'n', x: x, y: y - m/2, w: w, h: m, cursor: 'ns-resize' },
    { type: 's', x: x, y: y + h - m/2, w: w, h: m, cursor: 'ns-resize' },
    { type: 'w', x: x - m/2, y: y, w: m, h: h, cursor: 'ew-resize' },
    { type: 'e', x: x + w - m/2, y: y, w: m, h: h, cursor: 'ew-resize' },
    { type: 'nw', x: x - m/2, y: y - m/2, w: m, h: m, cursor: 'nwse-resize' },
    { type: 'ne', x: x + w - m/2, y: y - m/2, w: m, h: m, cursor: 'nesw-resize' },
    { type: 'sw', x: x - m/2, y: y + h - m/2, w: m, h: m, cursor: 'nesw-resize' },
    { type: 'se', x: x + w - m/2, y: y + h - m/2, w: m, h: m, cursor: 'nwse-resize' },
  ];

  return (
    <pixiContainer zIndex={isSelected ? 1 : 0}>
      <pixiGraphics
        ref={graphicsRef}
        draw={draw}
        eventMode={isInteractive ? "static" : "none"}
        cursor={isInteractive ? "pointer" : "default"}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      />
      {isSelected && isInteractive && onResizeDown && handles.map(h => (
        <pixiGraphics
          key={h.type}
          x={h.x}
          y={h.y}
          draw={(g) => handleDrawHandle(g, h.w, h.h)}
          eventMode="static"
          cursor={h.cursor}
          onPointerDown={(e: PIXI.FederatedPointerEvent) => onResizeDown(h.type, e)}
        />
      ))}
      {showGroupName && (
        <pixiText text={`${name || ''}`} x={x + 8} y={y + 8} style={{ fontSize: 32, fontWeight: 'bold', fill: '#ffffff', fontFamily: 'Inter' }} alpha={(isSelected ? 1 : 0.5) * (enabled !== false ? 1 : 0.3)} scale={0.5} eventMode="none" />
      )}
    </pixiContainer>
  );
};
