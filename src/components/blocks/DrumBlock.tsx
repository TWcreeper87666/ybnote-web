import React, { useCallback, useRef, useEffect } from "react";
import * as PIXI from "pixi.js";
import { DRUM_REGISTRY } from "../../config/instruments";

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
  isInvalid?: boolean;
  isHighlighted?: boolean;
  isAssignedHighlight?: boolean;
  isDimmed?: boolean;
}

export const DrumBlock: React.FC<DrumBlockProps> = ({
  x,
  y,
  pitch,
  instrument,
  volume = 1,
  isInteractive = true,
  blockColor,
  onPointerDown,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
  opacity = 1,
  showPitch,
  showInstrument,
  showVolume,
  playedAt,
  isSelected = false,
  isInvalid = false,
  isHighlighted = false,
  isAssignedHighlight = false,
  isDimmed = false,
}) => {
  const graphicsRef = useRef<PIXI.Graphics>(null);
  const ripplesRef = useRef<{ id: number; progress: number }[]>([]);
  const lastPlayedRef = useRef(playedAt || 0);

  const drumInfo = DRUM_REGISTRY.find(
    (d) => d.pitch === pitch || d.triggerPitch === pitch,
  );

  const displayLabel = drumInfo ? drumInfo.label : pitch;
  const finalColor = drumInfo ? drumInfo.color : blockColor;

  useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      if (Date.now() - playedAt < 2000) {
        ripplesRef.current.push({ id: playedAt, progress: 0 });
      }
      lastPlayedRef.current = playedAt;
    }
  }, [playedAt]);

  const draw = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();

      // Draw circular ripples
      ripplesRef.current.forEach((r) => {
        const radius = 30 + r.progress * 20;
        const alpha = 1 - r.progress;
        g.circle(30, 30, radius);
        g.stroke({ width: 3, color: finalColor, alpha: alpha });
      });

      // Selected outline glow (circular)
      if (isSelected) {
        g.circle(30, 30, 34);
        g.fill({ color: 0x6366f1, alpha: 0.5 }); // Indigo glow
      }

      if (isAssignedHighlight) {
        g.circle(30, 30, 36);
        g.stroke({ width: 3, color: 0x22c55e, alpha: 0.95 });
        g.circle(30, 30, 30);
        g.fill({ color: 0x22c55e, alpha: 0.18 });
      } else if (isHighlighted) {
        g.circle(30, 30, 36);
        g.stroke({ width: 3, color: 0x9ca3af, alpha: 0.85 });
      }

      g.circle(30, 30, 30); // Circular block
      g.fill({ color: finalColor, alpha: opacity });

      if (isInvalid) {
        g.stroke({ width: 4, color: 0xff3333, alpha: 1 });
      } else {
        g.stroke({
          width: isSelected ? 3 : 2,
          color: isSelected ? 0x4f46e5 : 0xffffff,
          alpha: isSelected ? 1 : 0.4,
        });
      }

      // Draw volume bar (curved arc)
      if (showVolume) {
        const radius = 25;
        const startAngle = (145 * Math.PI) / 180;
        const endAngle = (35 * Math.PI) / 180;
        const span = (110 * Math.PI) / 180;

        const startX = 30 + radius * Math.cos(startAngle);
        const startY = 30 + radius * Math.sin(startAngle);

        // Background track
        g.moveTo(startX, startY);
        g.arc(30, 30, radius, startAngle, endAngle, true);
        g.stroke({
          width: 4,
          color: 0x000000,
          alpha: 0.4,
          cap: "round",
          join: "round",
        });

        // Manual round cap for the left start point (since moveTo makes it a join)
        g.circle(startX, startY, 2);
        g.fill({ color: 0x000000, alpha: 0.4 });

        // Foreground volume
        if (volume > 0) {
          const volumeEndAngle = startAngle - span * volume;
          g.moveTo(startX, startY);
          g.arc(30, 30, radius, startAngle, volumeEndAngle, true);
          g.stroke({
            width: 4,
            color: 0xffffff,
            alpha: 0.9,
            cap: "round",
            join: "round",
          });

          // Manual round cap for the left start point
          g.circle(startX, startY, 2);
          g.fill({ color: 0xffffff, alpha: 0.9 });
        }
      }

      if (isDimmed) {
        g.circle(30, 30, 30);
        g.fill({ color: 0x000000, alpha: 0.55 });
      }
    },
    [
      blockColor,
      opacity,
      showVolume,
      volume,
      isSelected,
      isInvalid,
      isHighlighted,
      isAssignedHighlight,
      isDimmed,
    ],
  );

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (ripplesRef.current.length > 0) {
        ripplesRef.current.forEach((r) => (r.progress += delta * 2.5));
        ripplesRef.current = ripplesRef.current.filter((r) => r.progress < 1);
        if (graphicsRef.current) {
          draw(graphicsRef.current);
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [draw]);

  const instrumentIcon = "🥁";

  return (
    <pixiContainer
      label="note-block"
      x={x}
      y={y}
      zIndex={
        isSelected || isHighlighted || isAssignedHighlight
          ? 101
          : isDimmed
            ? 5
            : 10
      }
      eventMode={isInteractive ? "static" : "none"}
      cursor={isInteractive ? "pointer" : "default"}
      hitArea={new PIXI.Circle(30, 30, 30)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <pixiGraphics ref={graphicsRef} draw={draw} />
      {showPitch && (
        <pixiText
          text={displayLabel}
          x={30}
          y={30}
          anchor={0.5}
          style={{
            fontSize: 20,
            fill: "#ffffff",
            fontWeight: "bold",
            fontFamily: "Inter",
          }}
          scale={0.5}
        />
      )}
      {showInstrument && (
        <pixiText
          text={instrumentIcon}
          x={30}
          y={12}
          anchor={0.5}
          style={{ fontSize: 24 }}
          scale={0.5}
        />
      )}
    </pixiContainer>
  );
};
