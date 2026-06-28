import React, { useRef, useEffect, useCallback, useState } from "react";
import { useLevelEditorStore } from "../../store/useLevelEditorStore";
import type { EditorNote } from "../../types";
import { useStore } from "../../store/useStore";
import { getPitchColorHex } from "../../utils/colors";
import { getCandidateBlocks } from "../../utils/chartUtils";
import { PianoRollKeyboard } from "./PianoRollKeyboard";
import { playNote } from "../../utils/audio";
import { getTrackColor } from "../../utils/trackColors";
import { inputManager } from "../../inputs/InputManager";

// Layout constants
const ROW_HEIGHT = 16;
const MAX_PITCH = 127;
const TIMELINE_HEIGHT = 30;
const KEYBOARD_WIDTH = 60;

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function pitchToName(pitch: number): string {
  const note = NOTE_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${note}${octave}`;
}

function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

type DragAction =
  | "none"
  | "move"
  | "resize-left"
  | "resize-right"
  | "scrub"
  | "stretch-midi"
  | "erase"
  | "move-end-pos";

export const PianoRoll: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperHeight, setWrapperHeight] = useState(800);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineBgRef = useRef<HTMLCanvasElement>(null);
  const timelineFgRef = useRef<HTMLCanvasElement>(null);

  // Mutable refs for drag state (avoid re-renders during drag)
  const dragAction = useRef<DragAction>("none");
  const dragTargetNoteId = useRef<string | null>(null);
  const dragStartMouseX = useRef(0);
  const dragStartMouseY = useRef(0);
  const dragStartNotes = useRef<
    Map<string, { timeStart: number; duration: number; pitch: number }>
  >(new Map());
  const lastMousePos = useRef({ clientX: 0, clientY: 0 });
  const dragCurrentPitch = useRef(-1);
  const lastNoteDuration = useRef(0.5);

  const hasDragged = useRef(false);
  const justAddedNote = useRef(false);

  // Marquee
  const isMarqueeSelecting = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });
  const marqueeEnd = useRef({ x: 0, y: 0 });

  // Middle mouse pan
  const isMiddlePanning = useRef(false);
  const panStartMouseX = useRef(0);
  const panStartMouseY = useRef(0);
  const panStartScrollX = useRef(0);
  const panStartScrollY = useRef(0);

  // Playback animation
  const playbackRafId = useRef(0);
  const lastRafTime = useRef(0);

  // Fading animations
  const fadeAnimations = useRef<
    { x: number; y: number; w: number; h: number; opacity: number }[]
  >([]);
  const fadeRafId = useRef(0);

  // We need a late-bound ref to drawBgCanvas to use inside startFadeAnimation
  const drawBgCanvasRef = useRef<(() => void) | null>(null);

  const startFadeAnimation = useCallback(
    (x: number, y: number, w: number, h: number) => {
      fadeAnimations.current.push({ x, y, w, h, opacity: 1.0 });
      if (fadeAnimations.current.length === 1) {
        const animateFades = () => {
          if (fadeAnimations.current.length === 0) return;
          let active = false;
          for (let i = fadeAnimations.current.length - 1; i >= 0; i--) {
            fadeAnimations.current[i].opacity -= 0.05;
            if (fadeAnimations.current[i].opacity <= 0) {
              fadeAnimations.current.splice(i, 1);
            } else {
              active = true;
            }
          }
          if (drawBgCanvasRef.current) drawBgCanvasRef.current();
          if (active) {
            fadeRafId.current = requestAnimationFrame(animateFades);
          }
        };
        animateFades();
      }
    },
    [],
  );

  // --- Canvas Rendering ---

  const drawBgCanvas = useCallback(() => {
    const canvas = bgCanvasRef.current;
    const tCanvas = timelineBgRef.current;
    if (!canvas || !tCanvas) return;
    const ctx = canvas.getContext("2d");
    const tCtx = tCanvas.getContext("2d");
    if (!ctx || !tCtx) return;

    const store = useLevelEditorStore.getState();
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const zoom = store.zoomLevel;
    const scrollLeft = store.scrollLeft;
    const scrollTop = store.scrollTop;

    ctx.clearRect(0, 0, width, height);
    tCtx.clearRect(0, 0, width, TIMELINE_HEIGHT);

    // 1. Grid
    ctx.strokeStyle = "#2a2a30";
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Horizontal lines
    for (let p = 12; p <= MAX_PITCH; p++) {
      const y = (MAX_PITCH - p) * ROW_HEIGHT - scrollTop;
      if (y < -ROW_HEIGHT || y > height + ROW_HEIGHT) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    // Vertical lines
    const bpm = store.bpm || 120;
    const beatDuration = 60 / bpm;
    const pxPerBeat = zoom * beatDuration;
    let gridSubdivisions = 1;
    if (pxPerBeat > 200) gridSubdivisions = 4;
    else if (pxPerBeat > 100) gridSubdivisions = 2;

    if (pxPerBeat > 0) {
      const pxPerGrid = pxPerBeat / gridSubdivisions;
      const gridOffset = ((-scrollLeft % pxPerGrid) + pxPerGrid) % pxPerGrid;
      for (let x = gridOffset; x <= width; x += pxPerGrid) {
        const gridIndex = Math.round((x + scrollLeft) / pxPerGrid);
        if (gridIndex % gridSubdivisions === 0) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
      }
    }
    ctx.stroke();

    // Subdivisions lines
    if (gridSubdivisions > 1 && pxPerBeat > 0) {
      ctx.strokeStyle = "rgba(42, 42, 48, 0.4)";
      ctx.beginPath();
      const pxPerGrid = pxPerBeat / gridSubdivisions;
      const gridOffset = ((-scrollLeft % pxPerGrid) + pxPerGrid) % pxPerGrid;
      for (let x = gridOffset; x <= width; x += pxPerGrid) {
        const gridIndex = Math.round((x + scrollLeft) / pxPerGrid);
        if (gridIndex % gridSubdivisions !== 0) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
      }
      ctx.stroke();
    }

    // Highlight C keys (skip or alternate in Drum Mode)
    const currentTrack = store.getCurrentTrack();
    const isDrumMode =
      currentTrack?.instrument === "percussion" ||
      currentTrack?.instrument === "group_rect";

    if (isDrumMode) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
      for (let p = 12; p <= MAX_PITCH; p++) {
        if (p % 2 !== 0) {
          const y = (MAX_PITCH - p) * ROW_HEIGHT - scrollTop;
          if (y + ROW_HEIGHT < 0 || y > height) continue;
          ctx.fillRect(0, y, width, ROW_HEIGHT);
        }
      }
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      for (let p = 12; p <= MAX_PITCH; p++) {
        if (p % 12 === 0) {
          const y = (MAX_PITCH - p) * ROW_HEIGHT - scrollTop;
          if (y + ROW_HEIGHT < 0 || y > height) continue;
          ctx.fillRect(0, y, width, ROW_HEIGHT);
        }
      }
    }

    // 2. Timeline
    tCtx.fillStyle = "#1e1e28";
    tCtx.fillRect(0, 0, width, TIMELINE_HEIGHT);
    tCtx.strokeStyle = "#111";
    tCtx.beginPath();
    tCtx.moveTo(0, TIMELINE_HEIGHT);
    tCtx.lineTo(width, TIMELINE_HEIGHT);
    tCtx.stroke();

    tCtx.fillStyle = "#aaa";
    tCtx.font = "10px Inter, sans-serif";

    if (pxPerBeat > 0) {
      const pxPerGrid = pxPerBeat / gridSubdivisions;
      const startGrid = Math.max(0, Math.floor(scrollLeft / pxPerGrid));
      const endGrid = Math.ceil((scrollLeft + width) / pxPerGrid);
      for (let g = startGrid; g <= endGrid; g++) {
        const x = g * pxPerGrid - scrollLeft;
        if (x < -pxPerGrid || x > width + pxPerGrid) continue;

        if (g % (gridSubdivisions * 4) === 0) {
          // Downbeat
          tCtx.fillText(
            `${g / (gridSubdivisions * 4) + 1}`,
            x + 2,
            TIMELINE_HEIGHT - 4,
          );
          tCtx.fillRect(x, TIMELINE_HEIGHT - 8, 1, 8);
        } else if (g % gridSubdivisions === 0) {
          // Beat
          tCtx.fillRect(x, TIMELINE_HEIGHT - 4, 1, 4);
        } else {
          // Sub-beat
          tCtx.fillRect(x, TIMELINE_HEIGHT - 2, 1, 2);
        }
      }
    }

    // 2.5 Stretch MIDI handle
    const track = store.getCurrentTrack();
    if (track && store.selectedNoteIds.size > 1) {
      const selectedNotes = track.notes.filter((n) =>
        store.selectedNoteIds.has(n.id),
      );
      const trackMaxTime = Math.max(
        ...selectedNotes.map((n) => n.timeStart + n.duration),
      );
      const stretchX = trackMaxTime * zoom - scrollLeft;
      if (stretchX >= -24 && stretchX <= width + 24) {
        tCtx.fillStyle = "#4caf50";
        tCtx.fillRect(stretchX - 12, TIMELINE_HEIGHT / 2 - 8, 24, 16);
        tCtx.fillStyle = "#fff";
        tCtx.font = "10px monospace";
        tCtx.fillText("<->", stretchX - 9, TIMELINE_HEIGHT / 2 + 3);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(stretchX, 0);
        ctx.lineTo(stretchX, height);
        ctx.stroke();
      }
    }

    // 3. Notes
    if (!store.midiData) return;
    const selectedNoteIds = store.selectedNoteIds;

    for (const track of store.midiData.tracks) {
      const isSelectedTrack = track.id === store.selectedMidiTrackId;
      const isGhostVisible = store.ghostNoteVisibility[track.id];
      const isBackground = track.isBackground;

      if (!isSelectedTrack && !isGhostVisible) continue;

      const trackColor = getTrackColor(track.id);
      const mainBlocks = useLevelEditorStore.getState().blocks;

      for (const note of track.notes) {
        const noteX = note.timeStart * zoom - scrollLeft;
        const noteW = Math.max(note.duration * zoom, 2);
        const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT - scrollTop;

        if (noteX + noteW < 0 || noteX > width) continue;
        if (noteY + ROW_HEIGHT < 0 || noteY > height) continue;

        const candidates = isBackground ? [] : getCandidateBlocks(note, track);
        const hasMatchingBlock = candidates.length > 0;
        const isUnassignedSilent =
          !note.targetId && !hasMatchingBlock && !isBackground;

        if (isSelectedTrack) {
          const isSelected = selectedNoteIds.has(note.id);
          const baseColor = isBackground
            ? "rgba(120,120,120,0.45)"
            : isSelected
              ? "#ffb347"
              : trackColor;
          ctx.fillStyle = baseColor;
          ctx.fillRect(noteX, noteY, noteW, ROW_HEIGHT - 1);

          if (isUnassignedSilent) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = "#ef4444";
          } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = isSelected ? "#fff" : shadeColor(trackColor, -30);
          }
          ctx.strokeRect(noteX, noteY, noteW, ROW_HEIGHT - 1);
          ctx.setLineDash([]);

          if (note.targetId && !isBackground) {
            const targetBlock = mainBlocks.find((b) => b.id === note.targetId);
            const dotColor = targetBlock
              ? getPitchColorHex(targetBlock.pitch, 36)
              : "#a5b4fc";
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(noteX + 4, noteY + ROW_HEIGHT / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          if (!isBackground) {
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillRect(
              noteX,
              noteY + (ROW_HEIGHT - 4) / 2,
              noteW * note.velocity,
              3,
            );
          }
        } else {
          ctx.strokeStyle = isBackground ? "rgba(120,120,120,0.5)" : trackColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(noteX, noteY, noteW, ROW_HEIGHT - 1);
          ctx.fillStyle = isBackground
            ? "rgba(80,80,80,0.35)"
            : shadeColor(trackColor, -150);
          ctx.fillRect(noteX + 1, noteY + 1, noteW - 2, ROW_HEIGHT - 3);
        }
      }
    }

    // 4. Fade animations
    for (const anim of fadeAnimations.current) {
      const animX = anim.x - scrollLeft;
      const animY = anim.y - scrollTop;
      if (animX + anim.w < 0 || animX > width) continue;
      ctx.fillStyle = `rgba(255, 85, 85, ${anim.opacity})`;
      ctx.fillRect(animX, animY, anim.w, anim.h);
    }
  }, []);

  useEffect(() => {
    drawBgCanvasRef.current = drawBgCanvas;
  }, [drawBgCanvas]);

  const drawFgCanvas = useCallback(() => {
    const canvas = fgCanvasRef.current;
    const tCanvas = timelineFgRef.current;
    if (!canvas || !tCanvas) return;
    const ctx = canvas.getContext("2d");
    const tCtx = tCanvas.getContext("2d");
    if (!ctx || !tCtx) return;

    const store = useLevelEditorStore.getState();
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const zoom = store.zoomLevel;
    const scrollLeft = store.scrollLeft;

    ctx.clearRect(0, 0, width, height);
    tCtx.clearRect(0, 0, width, TIMELINE_HEIGHT);

    // 1. Playhead (Removed in favor of GlobalPlayhead in LevelEditorPage)

    // Anchor
    const anchorX = store.playbackAnchor * zoom - scrollLeft;
    if (anchorX >= -5 && anchorX <= width + 5) {
      tCtx.fillStyle = "rgba(255, 204, 0, 0.3)";
      tCtx.beginPath();
      tCtx.moveTo(anchorX - 5, 0);
      tCtx.lineTo(anchorX + 5, 0);
      tCtx.lineTo(anchorX, 8);
      tCtx.fill();
    }

    // End Position Marker
    const endX = store.chartEndPosition * zoom - scrollLeft;
    if (endX >= -10 && endX <= width + 10) {
      tCtx.fillStyle = "#ff4444";
      tCtx.beginPath();
      tCtx.moveTo(endX - 8, 0);
      tCtx.lineTo(endX + 8, 0);
      tCtx.lineTo(endX, 12);
      tCtx.fill();

      ctx.strokeStyle = "rgba(255, 68, 68, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    }

    // 2. Marquee
    if (isMarqueeSelecting.current) {
      ctx.fillStyle = "rgba(74, 144, 226, 0.2)";
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 1;
      const x =
        Math.min(marqueeStart.current.x, marqueeEnd.current.x) - scrollLeft;
      const y = Math.min(marqueeStart.current.y, marqueeEnd.current.y);
      const w = Math.abs(marqueeEnd.current.x - marqueeStart.current.x);
      const h = Math.abs(marqueeEnd.current.y - marqueeStart.current.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
  }, []);

  // --- Playback loop ---

  const playbackLoop = useCallback(
    function loop(time: DOMHighResTimeStamp) {
      const store = useLevelEditorStore.getState();
      if (!store.isPlaying) return;

      if (!lastRafTime.current) lastRafTime.current = time;
      const dt = (time - lastRafTime.current) / 1000;
      lastRafTime.current = time;

      const newPos = store.playbackPosition + dt * store.audioPlaybackRate;

      if (newPos >= store.chartEndPosition) {
        store.stopPlayback();
        return;
      }

      // Play notes that fall in range (from all unmuted tracks)
      if (store.midiData) {
        for (const track of store.midiData.tracks) {
          if (store.trackMute[track.id]) continue;

          for (const note of track.notes) {
            const newPosMs = newPos * 1000;
            const oldPosMs = store.playbackPosition * 1000;
            if (
              note.timeStart * 1000 >= oldPosMs &&
              note.timeStart * 1000 < newPosMs
            ) {
              const noteName = pitchToName(note.pitch);
              // Apply track velocity and store's overall MIDI volume
              const finalVelocity = note.velocity * (store.midiVolume / 100);
              playNote(noteName, finalVelocity, track.instrument);
            }
          }
        }
      }

      useLevelEditorStore.setState({ playbackPosition: newPos });
      drawFgCanvas();
      playbackRafId.current = requestAnimationFrame(loop);
    },
    [drawFgCanvas],
  );

  // --- Canvas sizing ---

  const resizeCanvases = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const viewportW = wrapper.clientWidth - KEYBOARD_WIDTH;
    const viewportH = wrapper.clientHeight - TIMELINE_HEIGHT;

    const setSize = (
      canvas: HTMLCanvasElement | null,
      w: number,
      h: number,
    ) => {
      if (!canvas) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx?.resetTransform();
      ctx?.scale(dpr, dpr);
    };

    setSize(bgCanvasRef.current, viewportW, viewportH);
    setSize(fgCanvasRef.current, viewportW, viewportH);
    setSize(timelineBgRef.current, viewportW, TIMELINE_HEIGHT);
    setSize(timelineFgRef.current, viewportW, TIMELINE_HEIGHT);

    setWrapperHeight(wrapper.clientHeight);

    drawBgCanvas();
    drawFgCanvas();
  }, [drawBgCanvas, drawFgCanvas]);

  // --- Mouse interaction helpers ---

  const getMouseCoords = useCallback((e: MouseEvent, forceTimeline = false) => {
    const fg = fgCanvasRef.current;
    const tFg = timelineFgRef.current;
    if (!fg || !tFg) return { x: 0, y: 0, isTimeline: false };

    const target = e.target as HTMLElement;
    let isTimeline =
      forceTimeline || target === tFg || target === timelineBgRef.current;
    if (dragAction.current === "scrub") isTimeline = true;

    const rect = isTimeline
      ? tFg.getBoundingClientRect()
      : fg.getBoundingClientRect();
    const store = useLevelEditorStore.getState();

    const x = e.clientX - rect.left + store.scrollLeft;
    const y = e.clientY - rect.top;
    return { x, y, isTimeline };
  }, []);

  const getHitTarget = useCallback(
    (x: number, y: number, isTimeline: boolean) => {
      if (isTimeline) {
        const store = useLevelEditorStore.getState();

        const endX = store.chartEndPosition * store.zoomLevel;
        if (x >= endX - 10 && x <= endX + 10) {
          return { type: "chart-end-pos" as const };
        }

        const track = store.getCurrentTrack();
        if (track && store.selectedNoteIds.size > 1) {
          const selectedNotes = track.notes.filter((n) =>
            store.selectedNoteIds.has(n.id),
          );
          const trackMaxTime = Math.max(
            ...selectedNotes.map((n) => n.timeStart + n.duration),
          );
          if (trackMaxTime > 0) {
            const stretchX = trackMaxTime * store.zoomLevel;
            if (x >= stretchX - 12 && x <= stretchX + 12) {
              return { type: "stretch-midi" as const, trackMaxTime };
            }
          }
        }
        return { type: "timeline" as const };
      }

      const store = useLevelEditorStore.getState();
      const track = store.getCurrentTrack();
      if (!track) return { type: "none" as const };

      const zoom = store.zoomLevel;
      const scrollTop = store.scrollTop;

      for (let i = track.notes.length - 1; i >= 0; i--) {
        const note = track.notes[i];
        const noteX = note.timeStart * zoom;
        const noteW = Math.max(note.duration * zoom, 2);
        const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT - scrollTop;

        if (
          x >= noteX &&
          x <= noteX + noteW &&
          y >= noteY &&
          y <= noteY + ROW_HEIGHT
        ) {
          const edgeThreshold = 4;
          if (x <= noteX + edgeThreshold)
            return { type: "resize-left" as const, note };
          if (x >= noteX + noteW - edgeThreshold)
            return { type: "resize-right" as const, note };
          return { type: "note" as const, note };
        }
      }
      return { type: "empty" as const };
    },
    [],
  );

  // --- Mouse handlers ---
  const wasPlayingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const store = useLevelEditorStore.getState();

      // Middle click for panning
      if (e.button === 1) {
        e.preventDefault();
        isMiddlePanning.current = true;
        panStartMouseX.current = e.clientX;
        panStartMouseY.current = e.clientY;
        panStartScrollX.current = store.scrollLeft;
        panStartScrollY.current = store.scrollTop;
        document.body.style.cursor = "grabbing";
        return;
      }

      const { x, y, isTimeline } = getMouseCoords(e);
      const target = getHitTarget(x, y, isTimeline);

      if (target.type === "chart-end-pos") {
        if (e.button === 0) {
          dragAction.current = "move-end-pos";
        }
        return;
      }

      if (target.type === "timeline") {
        if (e.button === 0) {
          wasPlayingRef.current = store.isPlaying;
          if (store.isPlaying) store.stopPlayback();
          store.setPlaybackAnchor(x / store.zoomLevel);
          dragAction.current = "scrub";
        }
        return;
      }

      if (target.type === "stretch-midi") {
        if (e.button === 0) {
          dragAction.current = "stretch-midi";
          dragStartMouseX.current = x;
          dragStartNotes.current.clear();
          const track = store.getCurrentTrack();
          if (track) {
            track.notes.forEach((n) => {
              if (store.selectedNoteIds.has(n.id)) {
                dragStartNotes.current.set(n.id, {
                  timeStart: n.timeStart,
                  duration: n.duration,
                  pitch: n.pitch,
                });
              }
            });
          }
        }
        return;
      }

      const track = store.getCurrentTrack();
      if (!track) return;

      if (e.button === 0) {
        // Left Click
        if (e.altKey) {
          wasPlayingRef.current = store.isPlaying;
          if (store.isPlaying) store.stopPlayback();
          store.setPlaybackAnchor(x / store.zoomLevel);
          dragAction.current = "scrub";
          return;
        }

        if (e.ctrlKey && target.type === "empty") {
          // Start marquee
          isMarqueeSelecting.current = true;
          marqueeStart.current = { x, y };
          marqueeEnd.current = { x, y };
          dragAction.current = "none";
          return;
        }

        if (
          target.type === "note" ||
          target.type === "resize-left" ||
          target.type === "resize-right"
        ) {
          const note = target.note!;
          if (!store.selectedNoteIds.has(note.id)) {
            store.selectNote(note.id, e.ctrlKey || e.metaKey);
          } else if (e.ctrlKey || e.metaKey) {
            store.deselectNote(note.id);
            return;
          }

          dragTargetNoteId.current = note.id;
          dragStartMouseX.current = x;
          dragStartMouseY.current = y + store.scrollTop;
          dragCurrentPitch.current = note.pitch;
          hasDragged.current = false;
          justAddedNote.current = false;

          dragStartNotes.current.clear();
          for (const n of track.notes) {
            if (store.selectedNoteIds.has(n.id) || n.id === note.id) {
              dragStartNotes.current.set(n.id, {
                timeStart: n.timeStart,
                duration: n.duration,
                pitch: n.pitch,
              });
            }
          }

          if (target.type === "note") {
            dragAction.current = "move";
            store.setPlaybackAnchor(note.timeStart);
          } else if (target.type === "resize-left") {
            dragAction.current = "resize-left";
            store.setPlaybackAnchor(note.timeStart);
          } else {
            dragAction.current = "resize-right";
            store.setPlaybackAnchor(note.timeStart + note.duration);
          }

          // Preview sound
          playNote(pitchToName(note.pitch), note.velocity, track.instrument);
        } else if (target.type === "empty") {
          // Add new note
          const zoom = store.zoomLevel;
          const pitch =
            MAX_PITCH - Math.floor((y + store.scrollTop) / ROW_HEIGHT);
          const timeStart = x / zoom;
          const duration = lastNoteDuration.current;

          store.setPlaybackAnchor(timeStart);

          const newNote: EditorNote = {
            id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            pitch: Math.max(12, Math.min(MAX_PITCH, pitch)),
            name: pitchToName(Math.max(12, Math.min(MAX_PITCH, pitch))),
            timeStart,
            duration,
            velocity: 0.8,
          };

          if (!e.shiftKey) store.clearNoteSelection();
          store.addNote(newNote, false);
          store.selectNote(newNote.id);

          playNote(newNote.name, 0.8, track.instrument);

          // Start drag for the new note
          dragTargetNoteId.current = newNote.id;
          dragStartMouseX.current = x;
          dragStartMouseY.current = y + store.scrollTop;
          dragAction.current = "move";
          dragCurrentPitch.current = newNote.pitch;
          dragStartNotes.current.clear();
          dragStartNotes.current.set(newNote.id, {
            timeStart: newNote.timeStart,
            duration: newNote.duration,
            pitch: newNote.pitch,
          });
          hasDragged.current = false;
          justAddedNote.current = true;
        }
      } else if (e.button === 2) {
        // Right click = erase
        dragAction.current = "erase";
        hasDragged.current = false;
        justAddedNote.current = false;
        if (
          target.type === "note" ||
          target.type === "resize-left" ||
          target.type === "resize-right"
        ) {
          const note = target.note!;
          const noteX = note.timeStart * store.zoomLevel;
          const noteW = Math.max(note.duration * store.zoomLevel, 2);
          const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT;
          startFadeAnimation(noteX, noteY, noteW, ROW_HEIGHT - 1);
          store.removeNote(note.id);
        } else if (target.type === "empty") {
          store.clearNoteSelection();
          dragAction.current = "none";
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [getMouseCoords, getHitTarget],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      lastMousePos.current = { clientX: e.clientX, clientY: e.clientY };
      const store = useLevelEditorStore.getState();

      if (isMiddlePanning.current) {
        const dx = e.clientX - panStartMouseX.current;
        const dy = e.clientY - panStartMouseY.current;
        const newScrollTop = panStartScrollY.current - dy;
        const wrapper = wrapperRef.current;
        const maxScrollTop = wrapper
          ? Math.max(
              0,
              (MAX_PITCH - 11) * ROW_HEIGHT -
                wrapper.clientHeight +
                TIMELINE_HEIGHT +
                20,
            )
          : 0;
        store.setScrollLeft(panStartScrollX.current - dx);
        store.setScrollTop(Math.max(0, Math.min(maxScrollTop, newScrollTop)));
        drawBgCanvas();
        drawFgCanvas();
        return;
      }

      const { x, y, isTimeline } = getMouseCoords(e);

      // Update cursor on hover
      if (
        dragAction.current === "none" &&
        !isMarqueeSelecting.current &&
        !isMiddlePanning.current
      ) {
        const target = getHitTarget(x, y, isTimeline);
        let cursor = "crosshair";
        if (e.altKey) cursor = "pointer";
        else if (
          target.type === "resize-left" ||
          target.type === "resize-right" ||
          target.type === "stretch-midi" ||
          target.type === "chart-end-pos"
        )
          cursor = "ew-resize";
        else if (target.type === "note") cursor = "move";
        else if (target.type === "timeline") cursor = "pointer";

        const fgCanvas = fgCanvasRef.current;
        const tFgCanvas = timelineFgRef.current;
        if (isTimeline && tFgCanvas) tFgCanvas.style.cursor = cursor;
        else if (!isTimeline && fgCanvas) fgCanvas.style.cursor = cursor;
      }

      if (dragAction.current === "scrub") {
        store.setPlaybackAnchor(x / store.zoomLevel);
        drawFgCanvas();
        return;
      }

      if (dragAction.current === "move-end-pos") {
        store.setChartEndPosition(x / store.zoomLevel);
        drawFgCanvas();
        return;
      }

      if (isMarqueeSelecting.current) {
        marqueeEnd.current = { x, y };
        drawFgCanvas();
        return;
      }

      if (dragAction.current === "erase") {
        const eraseTarget = getHitTarget(x, y, isTimeline);
        if (
          eraseTarget.type === "note" ||
          eraseTarget.type === "resize-left" ||
          eraseTarget.type === "resize-right"
        ) {
          const note = eraseTarget.note!;
          const noteX = note.timeStart * store.zoomLevel;
          const noteW = Math.max(note.duration * store.zoomLevel, 2);
          const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT;
          startFadeAnimation(noteX, noteY, noteW, ROW_HEIGHT - 1);
          store.removeNote(note.id);
          drawBgCanvas();
        }
        return;
      }

      if (dragAction.current !== "none") {
        hasDragged.current = true;
        const dxTime = (x - dragStartMouseX.current) / store.zoomLevel;
        const absoluteY = y + store.scrollTop;
        const dyRows = Math.floor(
          (absoluteY - dragStartMouseY.current) / ROW_HEIGHT,
        );

        const updates: { id: string; changes: Partial<EditorNote> }[] = [];
        let pitchChanged = false;
        let primaryNewPitch = dragCurrentPitch.current;

        if (dragAction.current === "stretch-midi") {
          const dxTime = (x - dragStartMouseX.current) / store.zoomLevel;
          const origMinTime = Math.min(
            ...Array.from(dragStartNotes.current.values()).map(
              (n) => n.timeStart,
            ),
          );
          const origMaxTime = Math.max(
            origMinTime + 0.01,
            ...Array.from(dragStartNotes.current.values()).map(
              (n) => n.timeStart + n.duration,
            ),
          );
          const origDuration = origMaxTime - origMinTime;
          const newMaxTime = Math.max(origMinTime + 0.01, origMaxTime + dxTime);
          const newDuration = newMaxTime - origMinTime;
          const ratio = newDuration / origDuration;

          const track = store.getCurrentTrack();
          if (track) {
            track.notes.forEach((n) => {
              const orig = dragStartNotes.current.get(n.id);
              if (orig) {
                updates.push({
                  id: n.id,
                  changes: {
                    timeStart:
                      origMinTime + (orig.timeStart - origMinTime) * ratio,
                    duration: orig.duration * ratio,
                  },
                });
              }
            });
          }
        } else {
          const bpm = store.bpm || 120;
          const beatDuration = 60 / bpm;
          const pxPerBeat = store.zoomLevel * beatDuration;
          let gridSubdivisions = 1;
          if (pxPerBeat > 200) gridSubdivisions = 4;
          else if (pxPerBeat > 100) gridSubdivisions = 2;
          const gridInterval = beatDuration / gridSubdivisions;

          const snapTime = (time: number) => {
            if (!e.shiftKey) return time;
            let bestTime = Math.round(time / gridInterval) * gridInterval;
            let minDist = Math.abs(bestTime - time) * store.zoomLevel;

            const track = store.getCurrentTrack();
            if (track) {
              track.notes.forEach((n) => {
                if (store.selectedNoteIds.has(n.id)) return;
                const dStart = Math.abs(n.timeStart - time) * store.zoomLevel;
                if (dStart < minDist && dStart < 15) {
                  minDist = dStart;
                  bestTime = n.timeStart;
                }
                const dEnd =
                  Math.abs(n.timeStart + n.duration - time) * store.zoomLevel;
                if (dEnd < minDist && dEnd < 15) {
                  minDist = dEnd;
                  bestTime = n.timeStart + n.duration;
                }
              });
            }
            return bestTime;
          };

          let snapOffsetTime = 0;
          const primaryOrig = dragTargetNoteId.current
            ? dragStartNotes.current.get(dragTargetNoteId.current)
            : undefined;

          if (primaryOrig) {
            if (dragAction.current === "move") {
              const rawNewTime = Math.max(0, primaryOrig.timeStart + dxTime);
              snapOffsetTime = snapTime(rawNewTime) - rawNewTime;
            } else if (dragAction.current === "resize-right") {
              const rawNewEnd =
                primaryOrig.timeStart + primaryOrig.duration + dxTime;
              snapOffsetTime = snapTime(rawNewEnd) - rawNewEnd;
            } else if (dragAction.current === "resize-left") {
              const maxDx = primaryOrig.duration - 0.01;
              const rawNewTime =
                primaryOrig.timeStart + Math.min(dxTime, maxDx);
              snapOffsetTime = snapTime(rawNewTime) - rawNewTime;
            }
          }

          store.selectedNoteIds.forEach((noteId) => {
            const orig = dragStartNotes.current.get(noteId);
            if (!orig) return;

            if (dragAction.current === "move") {
              let newPitch = orig.pitch - dyRows;
              newPitch = Math.max(12, Math.min(MAX_PITCH, newPitch));
              const newTime = Math.max(
                0,
                orig.timeStart + dxTime + snapOffsetTime,
              );
              updates.push({
                id: noteId,
                changes: {
                  timeStart: newTime,
                  pitch: newPitch,
                  name: pitchToName(newPitch),
                },
              });

              if (noteId === dragTargetNoteId.current) {
                store.setPlaybackAnchor(newTime);
                if (newPitch !== dragCurrentPitch.current) {
                  primaryNewPitch = newPitch;
                  pitchChanged = true;
                }
              }
            } else if (dragAction.current === "resize-right") {
              const newDuration = Math.max(
                0.01,
                orig.duration + dxTime + snapOffsetTime,
              );
              updates.push({ id: noteId, changes: { duration: newDuration } });
              if (noteId === dragTargetNoteId.current) {
                lastNoteDuration.current = newDuration;
                store.setPlaybackAnchor(orig.timeStart + newDuration);
              }
            } else if (dragAction.current === "resize-left") {
              const maxDx = orig.duration - 0.01;
              const actualDx = Math.min(dxTime + snapOffsetTime, maxDx);
              const newTime = Math.max(0, orig.timeStart + actualDx);
              const newDuration = orig.duration - actualDx;
              updates.push({
                id: noteId,
                changes: { timeStart: newTime, duration: newDuration },
              });
              if (noteId === dragTargetNoteId.current) {
                lastNoteDuration.current = newDuration;
                store.setPlaybackAnchor(newTime);
              }
            }
          });
        }

        if (updates.length > 0) {
          store.updateNotes(updates, false);
          drawBgCanvas();

          if (pitchChanged) {
            dragCurrentPitch.current = primaryNewPitch;
            playNote(
              pitchToName(primaryNewPitch),
              0.8,
              store.getCurrentTrack()?.instrument,
            );
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [getMouseCoords, getHitTarget, drawBgCanvas, drawFgCanvas],
  );

  const handleMouseUp = useCallback(
    function onMouseUp(e: MouseEvent) {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      if (isMiddlePanning.current) {
        isMiddlePanning.current = false;
        document.body.style.cursor = "";
        return;
      }

      const store = useLevelEditorStore.getState();

      if (dragAction.current === "scrub") {
        if (
          wasPlayingRef.current &&
          !useLevelEditorStore.getState().isPlaying
        ) {
          useLevelEditorStore.getState().togglePlayback();
        }
        dragAction.current = "none";
        return;
      }

      if (dragAction.current !== "none") {
        if (
          hasDragged.current ||
          justAddedNote.current ||
          dragAction.current === "erase"
        ) {
          store.commitHistory();
        }
        dragAction.current = "none";
        hasDragged.current = false;
        justAddedNote.current = false;
      }

      if (isMarqueeSelecting.current) {
        isMarqueeSelecting.current = false;

        const x1 = Math.min(marqueeStart.current.x, marqueeEnd.current.x);
        const y1 = Math.min(marqueeStart.current.y, marqueeEnd.current.y);
        const x2 = Math.max(marqueeStart.current.x, marqueeEnd.current.x);
        const y2 = Math.max(marqueeStart.current.y, marqueeEnd.current.y);

        const track = store.getCurrentTrack();
        if (track) {
          const zoom = store.zoomLevel;
          const scrollTop = store.scrollTop;
          if (!e.shiftKey) store.clearNoteSelection();

          for (const note of track.notes) {
            const nx = note.timeStart * zoom;
            const ny = (MAX_PITCH - note.pitch) * ROW_HEIGHT - scrollTop;
            const nw = Math.max(note.duration * zoom, 2);
            const nh = ROW_HEIGHT;

            if (nx < x2 && nx + nw > x1 && ny < y2 && ny + nh > y1) {
              store.selectNote(note.id, true);
            }
          }
          store.commitHistory();
        }

        drawBgCanvas();
        drawFgCanvas();
      }
    },
    [handleMouseMove, drawBgCanvas, drawFgCanvas],
  );

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      handleMouseDown(e);
    },
    [handleMouseDown, handleMouseMove, handleMouseUp],
  );

  // --- Wheel zoom / scroll ---

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const store = useLevelEditorStore.getState();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const zoomRatio = e.deltaY > 0 ? 1 / 1.5 : 1.5;
        const newZoom = Math.max(
          10,
          Math.min(1000, Math.round(store.zoomLevel * zoomRatio)),
        );
        if (newZoom === store.zoomLevel) return;
        const rect = wrapper.getBoundingClientRect();
        const physicalX = e.clientX - rect.left - KEYBOARD_WIDTH;
        store.setZoomLevel(newZoom, physicalX);
      } else if (e.shiftKey || Math.abs(e.deltaX) > 0) {
        // Horizontal scroll
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        store.setScrollLeft(store.scrollLeft + delta);
      } else {
        // Vertical scroll
        const wrapper = wrapperRef.current;
        const maxScrollTop = wrapper
          ? Math.max(
              0,
              (MAX_PITCH - 11) * ROW_HEIGHT -
                wrapper.clientHeight +
                TIMELINE_HEIGHT +
                20,
            )
          : 0;
        store.setScrollTop(
          Math.max(0, Math.min(maxScrollTop, store.scrollTop + e.deltaY)),
        );
      }

      resizeCanvases();

      if (dragAction.current !== "none" && lastMousePos.current.clientX !== 0) {
        const fakeEvent = new MouseEvent("mousemove", {
          clientX: lastMousePos.current.clientX,
          clientY: lastMousePos.current.clientY,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        });
        handleMouseMove(fakeEvent);
      }
    },
    [resizeCanvases, handleMouseMove],
  );

  // --- Keyboard shortcuts ---

  const handleKeyDown = useCallback(
    (key: string, e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const store = useLevelEditorStore.getState();
      if (store.activeTab !== "pianoroll") return;

      if (key === "Alt") {
        const fgCanvas = fgCanvasRef.current;
        if (fgCanvas && dragAction.current === "none") {
          fgCanvas.style.cursor = "pointer";
        }
      }

      if (e.key === " ") {
        e.preventDefault();
        store.togglePlayback();
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        const track = store.getCurrentTrack();
        let targetTime = 0;
        if (store.selectedNoteIds.size > 0 && track) {
          const selectedNotes = track.notes.filter((n) =>
            store.selectedNoteIds.has(n.id),
          );
          targetTime = Math.min(...selectedNotes.map((n) => n.timeStart));
        }
        store.setPlaybackAnchor(targetTime);

        const wrapper = wrapperRef.current;
        const viewportW = wrapper ? wrapper.clientWidth - KEYBOARD_WIDTH : 800;
        const visibleMinTime = store.scrollLeft / store.zoomLevel;
        const visibleMaxTime = (store.scrollLeft + viewportW) / store.zoomLevel;

        if (targetTime < visibleMinTime || targetTime > visibleMaxTime) {
          store.setScrollLeft(Math.max(0, targetTime * store.zoomLevel - 100));
        }
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        const track = store.getCurrentTrack();
        let targetTime = store.chartEndPosition;
        if (store.selectedNoteIds.size > 0 && track) {
          const selectedNotes = track.notes.filter((n) =>
            store.selectedNoteIds.has(n.id),
          );
          targetTime = Math.max(
            ...selectedNotes.map((n) => n.timeStart + n.duration),
          );
        }
        store.setPlaybackAnchor(targetTime);

        const wrapper = wrapperRef.current;
        const viewportW = wrapper ? wrapper.clientWidth - KEYBOARD_WIDTH : 800;
        const visibleMinTime = store.scrollLeft / store.zoomLevel;
        const visibleMaxTime = (store.scrollLeft + viewportW) / store.zoomLevel;

        if (targetTime < visibleMinTime || targetTime > visibleMaxTime) {
          store.setScrollLeft(Math.max(0, targetTime * store.zoomLevel - 100));
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          store.selectAllNotes();
          drawBgCanvas();
        } else if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          store.copySelectedNotes();
        } else if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          const s = useLevelEditorStore.getState();
          const track = s.getCurrentTrack();
          if (track && s.selectedNoteIds.size > 0) {
            const selected = track.notes.filter((n) =>
              s.selectedNoteIds.has(n.id),
            );
            const maxTime = Math.max(
              ...selected.map((n) => n.timeStart + n.duration),
            );
            const minTime = Math.min(...selected.map((n) => n.timeStart));
            const offset = maxTime - minTime;
            const newNotes = selected.map((n) => ({
              ...n,
              id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              timeStart: n.timeStart + offset,
            }));
            track.notes.push(...newNotes);
            useLevelEditorStore.setState({
              midiData: { ...s.midiData! },
              selectedNoteIds: new Set(newNotes.map((n) => n.id)),
            });
            s.commitHistory();
            drawBgCanvas();
          }
        } else if (e.key === "v" || e.key === "V") {
          e.preventDefault();
          store.pasteNotes(store.playbackAnchor);
          drawBgCanvas();
        } else if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) store.redo();
          else store.undo();
          drawBgCanvas();
          drawFgCanvas();
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          store.redo();
          drawBgCanvas();
          drawFgCanvas();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const track = store.getCurrentTrack();
        if (track) {
          track.notes.forEach((note) => {
            if (store.selectedNoteIds.has(note.id)) {
              const noteX = note.timeStart * store.zoomLevel;
              const noteW = Math.max(note.duration * store.zoomLevel, 2);
              const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT;
              startFadeAnimation(noteX, noteY, noteW, ROW_HEIGHT - 1);
            }
          });
        }
        store.removeSelectedNotes();
        drawBgCanvas();
      } else if (e.key === "Escape") {
        e.preventDefault();
        store.clearNoteSelection();
        drawBgCanvas();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [drawBgCanvas, drawFgCanvas],
  );

  const handleKeyUp = useCallback((key: string) => {
    if (key === "Alt") {
      const fgCanvas = fgCanvasRef.current;
      if (fgCanvas && dragAction.current === "none") {
        fgCanvas.style.cursor = "crosshair";
      }
    }
  }, []);

  // --- Subscriptions & lifecycle ---

  useEffect(() => {
    resizeCanvases();

    const observer = new ResizeObserver(() => resizeCanvases());
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    inputManager.on("keydown", handleKeyDown);
    inputManager.on("keyup", handleKeyUp);

    // Subscribe to store changes for redraw
    const unsub = useLevelEditorStore.subscribe((state, prevState) => {
      if (
        state.midiData !== prevState.midiData ||
        state.selectedNoteIds !== prevState.selectedNoteIds ||
        state.selectedMidiTrackId !== prevState.selectedMidiTrackId ||
        state.scrollLeft !== prevState.scrollLeft ||
        state.scrollTop !== prevState.scrollTop ||
        state.zoomLevel !== prevState.zoomLevel ||
        state.ghostNoteVisibility !== prevState.ghostNoteVisibility ||
        state.bpm !== prevState.bpm
      ) {
        drawBgCanvas();
        drawFgCanvas();
      }
      if (
        state.playbackPosition !== prevState.playbackPosition ||
        state.playbackAnchor !== prevState.playbackAnchor ||
        state.chartEndPosition !== prevState.chartEndPosition
      ) {
        drawFgCanvas();
      }

      // Handle playback start/stop
      if (state.isPlaying && !prevState.isPlaying) {
        lastRafTime.current = performance.now();
        playbackRafId.current = requestAnimationFrame(playbackLoop);
      } else if (!state.isPlaying && prevState.isPlaying) {
        cancelAnimationFrame(playbackRafId.current);
        drawFgCanvas();
      }
    });

    return () => {
      observer.disconnect();
      inputManager.off("keydown", handleKeyDown);
      inputManager.off("keyup", handleKeyUp);
      cancelAnimationFrame(playbackRafId.current);
      cancelAnimationFrame(fadeRafId.current);
      unsub();
    };
  }, [
    resizeCanvases,
    handleKeyDown,
    handleKeyUp,
    drawBgCanvas,
    drawFgCanvas,
    playbackLoop,
  ]);

  // Add wheel handler after mount (passive: false required)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener("wheel", handleWheel, { passive: false });
      return () => wrapper.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  const store = useLevelEditorStore();
  const hasTrack = !!store.midiData && store.midiData.tracks.length > 0;

  // Ensure canvases are resized when track is first loaded/created
  useEffect(() => {
    if (hasTrack) {
      // Use timeout to allow React to flush DOM and attach refs
      const timer = setTimeout(() => {
        resizeCanvases();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [hasTrack, resizeCanvases]);

  return (
    <div className="piano-roll-wrapper" ref={wrapperRef}>
      {!hasTrack && (
        <div className="pr-empty-state">
          Import a MIDI file to start editing
        </div>
      )}

      {hasTrack && (
        <>
          {/* Timeline */}
          <div className="pr-timeline-sticky" style={{ left: KEYBOARD_WIDTH }}>
            <canvas ref={timelineBgRef} className="pr-canvas-bg" />
            <canvas
              ref={timelineFgRef}
              className="pr-canvas-fg"
              style={{ cursor: "pointer" }}
              onMouseDown={(e) => onMouseDown(e.nativeEvent)}
              onMouseMove={(e) => {
                if (
                  dragAction.current === "none" &&
                  !isMarqueeSelecting.current &&
                  !isMiddlePanning.current
                ) {
                  handleMouseMove(e.nativeEvent);
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>

          {/* Keyboard */}
          <PianoRollKeyboard
            scrollTop={store.scrollTop}
            height={wrapperHeight}
          />

          {/* Canvas area */}
          <div
            className="pr-canvas-container"
            style={{ left: KEYBOARD_WIDTH, top: TIMELINE_HEIGHT }}
          >
            <canvas ref={bgCanvasRef} className="pr-canvas-bg" />
            <canvas
              ref={fgCanvasRef}
              className="pr-canvas-fg"
              style={{ cursor: "crosshair" }}
              onMouseDown={(e) => onMouseDown(e.nativeEvent)}
              onMouseMove={(e) => {
                if (
                  dragAction.current === "none" &&
                  !isMarqueeSelecting.current &&
                  !isMiddlePanning.current
                ) {
                  handleMouseMove(e.nativeEvent);
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </>
      )}
    </div>
  );
};
