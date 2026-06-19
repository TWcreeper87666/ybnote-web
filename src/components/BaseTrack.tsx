import React, { useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { computeTrackControlPoints } from '../utils/spline';

const TrackHandle: React.FC<{
  x: number;
  y: number;
  color: number;
  onDragStart: (e: PIXI.FederatedPointerEvent) => void;
  onRightClick: (e: PIXI.FederatedPointerEvent) => void;
}> = ({ x, y, color, onDragStart, onRightClick }) => {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.circle(0, 0, 8);
    g.fill({ color: 0xffffff });
    g.stroke({ width: 3, color });
    
    // larger hit area
    g.circle(0, 0, 16);
    g.fill({ color: 0x000000, alpha: 0.001 });
  }, [color]);

  return (
    <pixiGraphics
      x={x}
      y={y}
      draw={draw}
      eventMode="static"
      cursor="pointer"
      onPointerDown={(e: PIXI.FederatedPointerEvent) => { 
        e.stopPropagation(); 
        if (e.button === 0) onDragStart(e); 
        else if (e.button === 2) onRightClick(e);
      }}
    />
  );
};

const TrackPath: React.FC<{ track: any; isActive: boolean; isSelected: boolean }> = ({ track, isActive, isSelected }) => {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    if (track.nodes.length === 0) return;

    const isCircular = track.loop === true;
    const cps = computeTrackControlPoints(track.nodes, isCircular);
    const isEnabled = track.enabled !== false;
    let color = isSelected ? 0xec4899 : (isActive ? 0x6366f1 : 0x9ca3af);
    if (!isEnabled) {
      color = isSelected ? 0xf472b6 : 0x6b7280;
    }
    const alpha = isEnabled ? (isActive ? 1 : 0.5) : (isActive ? 0.6 : 0.3);
    const lineWidth = isEnabled ? 6 : 3;

    g.moveTo(track.nodes[0].x, track.nodes[0].y);
    for (let i = 1; i < track.nodes.length; i++) {
      const p2 = track.nodes[i];
      const cp1 = cps[i - 1].controlOut;
      const cp2 = cps[i].controlIn;
      g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    }
    if (isCircular && track.nodes.length > 2) {
      const p2 = track.nodes[0];
      const cp1 = cps[track.nodes.length - 1].controlOut;
      const cp2 = cps[0].controlIn;
      g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    }

    g.stroke({ width: lineWidth, color, alpha });

    if (track.nodes.length > 1) {
      const n = track.nodes.length;
      let p2 = cps[n - 1].controlIn;
      let endPoint = track.nodes[n - 1];

      if (isCircular && n > 2) {
        p2 = cps[0].controlIn;
        endPoint = track.nodes[0];
      }

      let dx = endPoint.x - p2.x;
      let dy = endPoint.y - p2.y;
      if (dx === 0 && dy === 0) {
        const prev = isCircular && n > 2 ? track.nodes[n - 1] : track.nodes[n - 2];
        dx = endPoint.x - prev.x;
        dy = endPoint.y - prev.y;
      }
      
      const angle = Math.atan2(dy, dx);
      const size = 16;
      const shift = size * 0.8 + 4;
      const cx = endPoint.x + Math.cos(angle) * shift;
      const cy = endPoint.y + Math.sin(angle) * shift;

      g.poly([
        cx + Math.cos(angle) * size, cy + Math.sin(angle) * size,
        cx + Math.cos(angle + Math.PI * 0.8) * size, cy + Math.sin(angle + Math.PI * 0.8) * size,
        cx + Math.cos(angle - Math.PI * 0.8) * size, cy + Math.sin(angle - Math.PI * 0.8) * size,
      ]);
      g.fill({ color, alpha });
    }
  }, [track, isActive, isSelected]);

  return <pixiGraphics draw={draw} eventMode="none" />;
};

export interface BaseTrackProps {
  track: any;
  isActive: boolean;
  isSelected: boolean;
  isInteractive?: boolean;
  onTrackPointerDown?: (e: PIXI.FederatedPointerEvent) => void;
  onNodeDragStart?: (nodeId: string, e: PIXI.FederatedPointerEvent) => void;
  onNodeRightClick?: (nodeId: string, e: PIXI.FederatedPointerEvent) => void;
}

export const BaseTrack: React.FC<BaseTrackProps> = ({
  track,
  isActive,
  isSelected,
  isInteractive = true,
  onTrackPointerDown,
  onNodeDragStart,
  onNodeRightClick
}) => {
  return (
    <pixiContainer zIndex={isSelected ? 102 : 20}>
      <TrackPath track={track} isActive={isActive} isSelected={isSelected} />
      
      {/* Invisible thick path for double click hit detection */}
      <pixiGraphics 
        eventMode={isInteractive ? "static" : "none"}
        cursor={isInteractive ? "pointer" : "default"}
        draw={(g) => {
          g.clear();
          if (track.nodes.length === 0) return;
          const isCircular = track.loop === true;
          const cps = computeTrackControlPoints(track.nodes, isCircular);

          g.moveTo(track.nodes[0].x, track.nodes[0].y);
          for (let i = 1; i < track.nodes.length; i++) {
            const p2 = track.nodes[i];
            const cp1 = cps[i - 1].controlOut;
            const cp2 = cps[i].controlIn;
            g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
          }
          if (isCircular && track.nodes.length > 2) {
            const p2 = track.nodes[0];
            const cp1 = cps[track.nodes.length - 1].controlOut;
            const cp2 = cps[0].controlIn;
            g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
          }
          g.stroke({ width: 12, color: 0x000000, alpha: 0.001 }); // invisible hit area
        }}
        onPointerDown={onTrackPointerDown as any}
      />

      {isActive && isInteractive && track.nodes.map((node: any) => (
        <React.Fragment key={node.id}>
          <TrackHandle 
            x={node.x} y={node.y} color={0x6366f1} 
            onDragStart={(e) => onNodeDragStart && onNodeDragStart(node.id, e)}
            onRightClick={(e) => onNodeRightClick && onNodeRightClick(node.id, e)}
          />
        </React.Fragment>
      ))}
    </pixiContainer>
  );
};
