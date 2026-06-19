import React, { useCallback, useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';

export interface BaseBlockProps {
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

export const BaseBlock: React.FC<BaseBlockProps> = ({
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
    
    // Draw ripples
    ripplesRef.current.forEach(r => {
      const size = 60 + r.progress * 40; 
      const alpha = 1 - r.progress; 
      const offset = (size - 60) / 2;
      g.roundRect(-offset, -offset, size, size, 8);
      g.stroke({ width: 3, color: blockColor, alpha: alpha });
    });
    
    // Selected outline glow
    if (isSelected) {
      g.roundRect(-4, -4, 68, 68, 10);
      g.fill({ color: 0x6366f1, alpha: 0.5 }); // Indigo glow
    }

    g.roundRect(0, 0, 60, 60, 8); // Square block
    g.fill({ color: blockColor, alpha: opacity });
    g.stroke({ width: isSelected ? 3 : 2, color: isSelected ? 0x4f46e5 : 0xffffff, alpha: isSelected ? 1 : 0.4 });

    // Draw volume bar
    if (showVolume) {
      g.roundRect(4, 50, 52, 6, 3);
      g.fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(4, 50, 52 * volume, 6, 3);
      g.fill({ color: 0xffffff, alpha: 0.8 });
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

  let instrumentIcon = '🎵';
  if (instrument === 'piano') instrumentIcon = '🎹';
  else if (instrument === 'synth') instrumentIcon = '📻';
  else if (instrument === 'bass') instrumentIcon = '🎸';
  else if (instrument === 'percussion') instrumentIcon = '🥁';

  return (
    <pixiContainer
      label="note-block"
      x={x}
      y={y}
      zIndex={isSelected ? 101 : 10}
      eventMode={isInteractive ? "static" : "none"}
      cursor={isInteractive ? "pointer" : "default"}
      hitArea={new PIXI.Rectangle(0, 0, 60, 60)}
      onPointerDown={onPointerDown as any}
      onPointerUp={onPointerUp as any}
      onPointerEnter={onPointerEnter as any}
      onPointerLeave={onPointerLeave as any}
    >
      <pixiGraphics ref={graphicsRef} draw={draw} />
      {showPitch && (
        // @ts-ignore
        <pixiText text={pitch} x={30} y={30} anchor={0.5} style={{ fontSize: 32, fill: '#ffffff', fontWeight: 'bold', fontFamily: 'Inter' }} scale={0.5} />
      )}
      {showInstrument && (
        // @ts-ignore
        <pixiText text={instrumentIcon} x={42} y={4} style={{ fontSize: 24 }} scale={0.5} />
      )}
    </pixiContainer>
  );
};
