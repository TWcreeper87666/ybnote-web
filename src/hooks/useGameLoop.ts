import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { playNote } from '../utils/audio';
import { computeTrackControlPoints } from '../utils/spline';

function getBezierPoint(t: number, p0: any, p1: any, p2: any, p3: any) {
  const cX = 3 * (p1.x - p0.x);
  const bX = 3 * (p2.x - p1.x) - cX;
  const aX = p3.x - p0.x - cX - bX;

  const cY = 3 * (p1.y - p0.y);
  const bY = 3 * (p2.y - p1.y) - cY;
  const aY = p3.y - p0.y - cY - bY;

  const x = (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0.x;
  const y = (aY * Math.pow(t, 3)) + (bY * Math.pow(t, 2)) + (cY * t) + p0.y;

  return { x, y };
}

function rectIntersect(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function useGameLoop() {
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);
  // Store previously triggered blocks to only trigger once per intersection
  const triggeredBlocksRef = useRef<Map<string, Set<string>>>(new Map());

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = (time - lastTimeRef.current) / 1000; // in seconds
      const state = useStore.getState();

      if (state.isPlaying) {
        let updatedRunners = [...state.runners];
        let hasChanges = false;
        const currentBlocks = state.blocks;
        const currentGroupRects = state.groupRects;

        // Ensure we have a runner for each track
        state.tracks.forEach(track => {
          if (!updatedRunners.find(r => r.trackId === track.id)) {
            updatedRunners.push({ id: Math.random().toString(), trackId: track.id, progress: 0 });
            hasChanges = true;
          }
        });

        // Update runners
        updatedRunners = updatedRunners.map(runner => {
          const track = state.tracks.find(t => t.id === runner.trackId);
          if (!track || track.nodes.length < 2) return runner;

          const segmentsCount = track.loop ? track.nodes.length : track.nodes.length - 1;
          const speed = track.bpm / 60; // segments per second
          let newProgress = runner.progress + speed * deltaTime;

          if (newProgress >= segmentsCount) {
            if (track.loop) {
              newProgress = newProgress % segmentsCount;
            } else {
              newProgress = segmentsCount; // stay at end
            }
          }

          // Compute exact position
          const cps = computeTrackControlPoints(track.nodes, track.loop);
          
          const segmentIndex = Math.min(Math.floor(newProgress), segmentsCount - 1);
          const segmentT = newProgress - segmentIndex;
          
          const p1 = track.nodes[segmentIndex];
          const p2 = track.nodes[(segmentIndex + 1) % track.nodes.length];
          const cp1 = cps[segmentIndex].controlOut;
          const cp2 = cps[(segmentIndex + 1) % track.nodes.length].controlIn;

          const pos = getBezierPoint(segmentT, p1, cp1, cp2, p2);

          // Collision detection
          if (!triggeredBlocksRef.current.has(runner.id)) {
            triggeredBlocksRef.current.set(runner.id, new Set());
          }
          const memory = triggeredBlocksRef.current.get(runner.id)!;
          
          const runnerRadius = 10;

          currentBlocks.forEach(block => {
            const isIntersecting = rectIntersect(
              pos.x - runnerRadius, pos.y - runnerRadius, runnerRadius * 2, runnerRadius * 2,
              block.x, block.y, 60, 60
            );

            if (isIntersecting) {
              if (!memory.has(block.id)) {
                // Trigger sound
                playNote(block.pitch, block.volume ?? 1, block.instrument ?? 'piano');
                state.updateBlock(block.id, { playedAt: Date.now() });
                memory.add(block.id);
              }
            } else {
              // If we are not intersecting anymore, remove from memory so it can be triggered again later if the track loops or self-intersects
              if (memory.has(block.id)) {
                memory.delete(block.id);
              }
            }
          });

          currentGroupRects.forEach(groupRect => {
            const isIntersecting = rectIntersect(
              pos.x - runnerRadius, pos.y - runnerRadius, runnerRadius * 2, runnerRadius * 2,
              groupRect.x, groupRect.y, groupRect.w, groupRect.h
            );

            const memoryId = `groupRect:${groupRect.id}`;

            if (isIntersecting) {
              if (!memory.has(memoryId)) {
                state.updateGroupRect(groupRect.id, { playedAt: Date.now() });
                memory.add(memoryId);

                // Trigger all blocks inside this group rect
                currentBlocks.forEach(block => {
                  const isBlockInside = rectIntersect(
                    groupRect.x, groupRect.y, groupRect.w, groupRect.h,
                    block.x, block.y, 60, 60
                  );
                  if (isBlockInside && !memory.has(block.id)) {
                    playNote(block.pitch, block.volume ?? 1, block.instrument ?? 'piano');
                    state.updateBlock(block.id, { playedAt: Date.now() });
                    // Add to memory so it doesn't double-trigger if the runner is simultaneously touching the block
                    memory.add(block.id);
                  }
                });
              }
            } else {
              if (memory.has(memoryId)) {
                memory.delete(memoryId);
              }
            }
          });

          return { ...runner, progress: newProgress };
        });

        if (hasChanges || updatedRunners.length > 0) {
          useStore.setState({ runners: updatedRunners });
        }
      } else {
        // Not playing, clear triggers
        triggeredBlocksRef.current.clear();
      }
    }
    
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);
}
