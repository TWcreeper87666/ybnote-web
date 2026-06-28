import React, { useCallback, useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { getInstrumentById } from '../../config/instruments';

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
  isInvalid?: boolean;
  isHighlighted?: boolean;
  highlightIntensity?: number;
}

export const BaseBlock: React.FC<BaseBlockProps> = ({
  x, y, pitch, instrument, volume = 1, isInteractive = true, blockColor, onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, opacity = 1, showPitch, showInstrument, showVolume, playedAt, isSelected = false, isInvalid = false, isHighlighted = false, highlightIntensity = 1
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

    if (isHighlighted) {
      g.roundRect(-6, -6, 72, 72, 10);
      g.stroke({ width: 3, color: 0x00d4ff, alpha: 0.4 + highlightIntensity * 0.6 });
      g.roundRect(0, 0, 60, 60, 8);
      g.fill({ color: 0x00d4ff, alpha: 0.08 + highlightIntensity * 0.12 });
    }

    g.roundRect(0, 0, 60, 60, 8); // Square block
    g.fill({ color: blockColor, alpha: opacity });
    
    if (isInvalid) {
      g.stroke({ width: 4, color: 0xff3333, alpha: 1 });
    } else {
      g.stroke({ width: isSelected ? 3 : 2, color: isSelected ? 0x4f46e5 : 0xffffff, alpha: isSelected ? 1 : 0.4 });
    }

    // Draw volume bar
    if (showVolume) {
      g.roundRect(4, 50, 52, 6, 3);
      g.fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(4, 50, 52 * volume, 6, 3);
      g.fill({ color: 0xffffff, alpha: 0.8 });
    }
  }, [blockColor, opacity, showVolume, volume, isSelected, isInvalid, isHighlighted, highlightIntensity]);

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

  const instrumentIcon = getInstrumentById(instrument)?.icon ?? '🎵';

  return (
    <pixiContainer
      label="note-block"
      x={x}
      y={y}
      zIndex={isSelected ? 101 : 10}
      eventMode={isInteractive ? "static" : "none"}
      cursor={isInteractive ? "pointer" : "default"}
      hitArea={new PIXI.Rectangle(0, 0, 60, 60)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <pixiGraphics ref={graphicsRef} draw={draw} />
      {showPitch && (
        <pixiText text={pitch} x={30} y={30} anchor={0.5} style={{ fontSize: 32, fill: '#ffffff', fontWeight: 'bold', fontFamily: 'Inter' }} scale={0.5} />
      )}
      {showInstrument && (
        <pixiText text={instrumentIcon} x={42} y={4} style={{ fontSize: 24 }} scale={0.5} />
      )}
    </pixiContainer>
  );
};
