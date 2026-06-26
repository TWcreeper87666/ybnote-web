import React, { useRef } from 'react';
import { useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';

export type TrailStroke = {
  id: number;
  points: { x: number, y: number, time: number }[];
};

type IdleParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  birthTime: number;
};

const FADE_TIME = 500;
const PARTICLE_LIFE = 600;
const PARTICLES_PER_TICK = 3;
const MAX_PARTICLES = 250;

export const TrailRenderer: React.FC<{
  activeStrokesRef: React.MutableRefObject<TrailStroke[]>;
  currentStrokeId: React.MutableRefObject<number | null>;
}> = ({ activeStrokesRef, currentStrokeId }) => {
  const gRef = useRef<PIXI.Graphics>(null);
  const idleParticlesRef = useRef<IdleParticle[]>([]);

  useTick(() => {
    if (!gRef.current) return;
    const now = Date.now();

    // Keep tip fresh and prune old points
    activeStrokesRef.current.forEach(stroke => {
      if (stroke.id === currentStrokeId.current && stroke.points.length > 0) {
        stroke.points[stroke.points.length - 1].time = now;
      }
      stroke.points = stroke.points.filter(p => now - p.time < FADE_TIME);
    });
    activeStrokesRef.current = activeStrokesRef.current.filter(s => s.points.length > 0);

    // Spawn idle particles at cursor while mouse is held
    if (currentStrokeId.current !== null && idleParticlesRef.current.length < MAX_PARTICLES) {
      const activeStroke = activeStrokesRef.current.find(s => s.id === currentStrokeId.current);
      if (activeStroke && activeStroke.points.length > 0) {
        const tip = activeStroke.points[activeStroke.points.length - 1];
        for (let i = 0; i < PARTICLES_PER_TICK; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 1.8 + 0.3;
          idleParticlesRef.current.push({
            x: tip.x,
            y: tip.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            birthTime: now,
          });
        }
      }
    }

    // Update and prune particles
    idleParticlesRef.current = idleParticlesRef.current.filter(p => {
      const age = now - p.birthTime;
      if (age >= PARTICLE_LIFE) return false;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      return true;
    });

    const g = gRef.current;
    g.clear();

    // Draw trail strokes
    activeStrokesRef.current.forEach(stroke => {
      const points = stroke.points;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const steps = Math.max(1, Math.ceil(dist / 8));

        for (let j = 0; j < steps; j++) {
          const t1 = j / steps;
          const t2 = (j + 1) / steps;

          const x1 = p1.x + (p2.x - p1.x) * t1;
          const y1 = p1.y + (p2.y - p1.y) * t1;
          const x2 = p1.x + (p2.x - p1.x) * t2;
          const y2 = p1.y + (p2.y - p1.y) * t2;

          const midTime = p1.time + (p2.time - p1.time) * ((t1 + t2) / 2);
          const age = now - midTime;
          const life = Math.max(0, 1 - age / FADE_TIME);
          const easeLife = life * life * life;

          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke({ width: 25 * easeLife, color: 0x8b5cf6, alpha: 0.3, cap: 'round' });

          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke({ width: 8 * easeLife, color: 0xffffff, alpha: 1, cap: 'round' });
        }
      }
    });

    // Draw idle particles
    idleParticlesRef.current.forEach(p => {
      const age = now - p.birthTime;
      const t = 1 - age / PARTICLE_LIFE;
      const ease = t * t * t;

      // Glow
      g.circle(p.x, p.y, 5 * t);
      g.fill({ color: 0x8b5cf6, alpha: ease * 0.5 });

      // Core
      g.circle(p.x, p.y, 2.5 * t);
      g.fill({ color: 0xffffff, alpha: ease });
    });
  });

  return <pixiGraphics ref={gRef} zIndex={200} draw={() => {}} eventMode="none" />;
};