import React, { useCallback, useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';

export interface DrumBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
  instrument: string;
  volume: number;
  blockColor: number;
  opacity: number;
  isSelected?: boolean;
  showPitch: boolean;
  showInstrument: boolean;
  showVolume: boolean;
  playedAt?: number;
  isInteractive?: boolean;
  onPointerDown?: (e: PIXI.FederatedPointerEvent) => void;
  onPointerUp?: (e: PIXI.FederatedPointerEvent) => void;
  onPointerEnter?: (e: PIXI.FederatedPointerEvent) => void;
  onPointerLeave?: (e: PIXI.FederatedPointerEvent) => void;
}

export const DrumBlock: React.FC<DrumBlockProps> = ({
  x, y, pitch, instrument, volume = 1, isInteractive = true, blockColor, onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, opacity = 1, showPitch, showInstrument, showVolume, playedAt, isSelected = false
}) => {
  const graphicsRef = useRef<PIXI.Graphics>(null);
  const ripplesRef = useRef<{id: number, progress: number}[]>([]);
  const lastPlayedRef = useRef(playedAt && Date.now() - playedAt > 2000 ? playedAt : 0);

  useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      lastPlayedRef.current = playedAt;
      ripplesRef.current.push({ id: playedAt, progress: 0 });
    }
  }, [playedAt]);

  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    
    // Draw circular ripples
    ripplesRef.current.forEach(r => {
      const radius = 30 + r.progress * 20; 
      const alpha = 1 - r.progress; 
      g.circle(30, 30, radius);
      g.stroke({ width: 3, color: blockColor, alpha: alpha });
    });
    
    // Selected outline glow (circular)
    if (isSelected) {
      g.circle(30, 30, 34);
      g.fill({ color: 0x6366f1, alpha: 0.5 }); // Indigo glow
    }

    g.circle(30, 30, 30); // Circular block
    g.fill({ color: blockColor, alpha: opacity });
    g.stroke({ width: isSelected ? 3 : 2, color: isSelected ? 0x4f46e5 : 0xffffff, alpha: isSelected ? 1 : 0.4 });

    // Draw volume bar (curved arc)
    if (showVolume) {
      const radius = 25;
      const startAngle = 145 * Math.PI / 180;
      const endAngle = 35 * Math.PI / 180;
      const span = 110 * Math.PI / 180;

      const startX = 30 + radius * Math.cos(startAngle);
      const startY = 30 + radius * Math.sin(startAngle);

      // Background track
      g.moveTo(startX, startY);
      g.arc(30, 30, radius, startAngle, endAngle, true);
      g.stroke({ width: 4, color: 0x000000, alpha: 0.4, cap: 'round', join: 'round' });
      
      // Manual round cap for the left start point (since moveTo makes it a join)
      g.circle(startX, startY, 2);
      g.fill({ color: 0x000000, alpha: 0.4 });

      // Foreground volume
      if (volume > 0) {
        const volumeEndAngle = startAngle - span * volume;
        g.moveTo(startX, startY);
        g.arc(30, 30, radius, startAngle, volumeEndAngle, true);
        g.stroke({ width: 4, color: 0xffffff, alpha: 0.9, cap: 'round', join: 'round' });
        
        // Manual round cap for the left start point
        g.circle(startX, startY, 2);
        g.fill({ color: 0xffffff, alpha: 0.9 });
      }
    }
  }, [blockColor, opacity, showVolume, volume, isSelected]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const tick = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      
      if (ripplesRef.current.length > 0) {
        ripplesRef.current.forEach(r => r.progress += delta * 2.5);
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

  let instrumentIcon = '🥁';
  if (instrument === 'piano') instrumentIcon = '🎹';
  else if (instrument === 'synth') instrumentIcon = '📻';
  else if (instrument === 'bass') instrumentIcon = '🎸';

  return (
    <pixiContainer
      label="drum-block"
      x={x}
      y={y}
      zIndex={isSelected ? 101 : 10}
      eventMode={isInteractive ? "static" : "none"}
      cursor={isInteractive ? "pointer" : "default"}
      hitArea={new PIXI.Circle(30, 30, 30)}
      onPointerDown={onPointerDown as any}
      onPointerUp={onPointerUp as any}
      onPointerEnter={onPointerEnter as any}
      onPointerLeave={onPointerLeave as any}
    >
      <pixiGraphics ref={graphicsRef} draw={draw} />
      {showPitch && (
        // @ts-ignore
        <pixiText text={pitch} x={30} y={30} anchor={0.5} style={{ fontSize: 26, fill: '#ffffff', fontWeight: 'bold', fontFamily: 'Inter' }} scale={0.5} />
      )}
      {showInstrument && (
        // @ts-ignore
        <pixiText text={instrumentIcon} x={30} y={10} anchor={0.5} style={{ fontSize: 24 }} scale={0.5} />
      )}
    </pixiContainer>
  );
};
