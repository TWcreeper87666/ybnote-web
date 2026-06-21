import React, { useRef, useEffect, useCallback } from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import type { EditorNote } from '../../store/useLevelEditorStore';
import { PianoRollKeyboard } from './PianoRollKeyboard';
import { playNote } from '../../utils/audio';
import { getTrackColor } from '../../utils/trackColors';

// Layout constants
const ROW_HEIGHT = 16;
const MAX_PITCH = 127;
const TIMELINE_HEIGHT = 30;
const KEYBOARD_WIDTH = 60;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function pitchToName(pitch: number): string {
  const note = NOTE_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${note}${octave}`;
}

function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

type DragAction = 'none' | 'move' | 'resize-left' | 'resize-right' | 'scrub' | 'stretch-midi' | 'erase' | 'move-end-pos';

export const PianoRoll: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineBgRef = useRef<HTMLCanvasElement>(null);
  const timelineFgRef = useRef<HTMLCanvasElement>(null);

  // Mutable refs for drag state (avoid re-renders during drag)
  const dragAction = useRef<DragAction>('none');
  const dragTargetNoteId = useRef<string | null>(null);
  const dragStartMouseX = useRef(0);
  const dragStartMouseY = useRef(0);
  const dragStartNotes = useRef<Map<string, { timeStart: number; duration: number; pitch: number }>>(new Map());
  const dragCurrentPitch = useRef(-1);
  const lastNoteDuration = useRef(0.5);

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
  const playbackStartWallTime = useRef(0);

  // Fading animations
  const fadeAnimations = useRef<{x: number, y: number, w: number, h: number, opacity: number}[]>([]);
  const fadeRafId = useRef(0);

  // We need a late-bound ref to drawBgCanvas to use inside startFadeAnimation
  const drawBgCanvasRef = useRef<(() => void) | null>(null);

  const startFadeAnimation = useCallback((x: number, y: number, w: number, h: number) => {
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
  }, []);

  // --- Canvas Rendering ---

  const drawBgCanvas = useCallback(() => {
    const canvas = bgCanvasRef.current;
    const tCanvas = timelineBgRef.current;
    if (!canvas || !tCanvas) return;
    const ctx = canvas.getContext('2d');
    const tCtx = tCanvas.getContext('2d');
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
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Horizontal lines
    for (let p = 0; p <= MAX_PITCH; p++) {
      const y = (MAX_PITCH - p) * ROW_HEIGHT - scrollTop;
      if (y < -ROW_HEIGHT || y > height + ROW_HEIGHT) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    // Vertical lines (beats)
    const bpm = store.bpm || 120;
    const pxPerBeat = zoom * (60 / bpm);
    if (pxPerBeat > 0) {
      const gridOffset = (((-scrollLeft) % pxPerBeat) + pxPerBeat) % pxPerBeat;
      for (let x = gridOffset; x <= width; x += pxPerBeat) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
    }
    ctx.stroke();

    // Highlight C keys
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let p = 0; p <= MAX_PITCH; p++) {
      if (p % 12 === 0) {
        const y = (MAX_PITCH - p) * ROW_HEIGHT - scrollTop;
        if (y + ROW_HEIGHT < 0 || y > height) continue;
        ctx.fillRect(0, y, width, ROW_HEIGHT);
      }
    }

    // 2. Timeline
    tCtx.fillStyle = '#1e1e28';
    tCtx.fillRect(0, 0, width, TIMELINE_HEIGHT);
    tCtx.strokeStyle = '#111';
    tCtx.beginPath();
    tCtx.moveTo(0, TIMELINE_HEIGHT);
    tCtx.lineTo(width, TIMELINE_HEIGHT);
    tCtx.stroke();

    tCtx.fillStyle = '#aaa';
    tCtx.font = '10px Inter, sans-serif';

    if (pxPerBeat > 0) {
      const startBeat = Math.max(0, Math.floor(scrollLeft / pxPerBeat));
      const endBeat = Math.ceil((scrollLeft + width) / pxPerBeat);
      for (let b = startBeat; b <= endBeat; b++) {
        const x = b * pxPerBeat - scrollLeft;
        if (x < -pxPerBeat || x > width + pxPerBeat) continue;
        if (b % 4 === 0) {
          tCtx.fillText(`${b / 4 + 1}`, x + 2, TIMELINE_HEIGHT - 4);
          tCtx.fillRect(x, TIMELINE_HEIGHT - 8, 1, 8);
        } else {
          tCtx.fillRect(x, TIMELINE_HEIGHT - 4, 1, 4);
        }
      }
    }

    // 2.5 Stretch MIDI handle
    const track = store.getCurrentTrack();
    if (track && store.selectedNoteIds.size > 1) {
      const selectedNotes = track.notes.filter(n => store.selectedNoteIds.has(n.id));
      const trackMaxTime = Math.max(...selectedNotes.map(n => n.timeStart + n.duration));
      const stretchX = trackMaxTime * zoom - scrollLeft;
      if (stretchX >= -24 && stretchX <= width + 24) {
        tCtx.fillStyle = '#4caf50';
        tCtx.fillRect(stretchX - 12, TIMELINE_HEIGHT / 2 - 8, 24, 16);
        tCtx.fillStyle = '#fff';
        tCtx.font = '10px monospace';
        tCtx.fillText('<->', stretchX - 9, TIMELINE_HEIGHT / 2 + 3);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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
      const isSelectedTrack = track.id === store.selectedTrackId;
      const isGhostVisible = store.ghostNoteVisibility[track.id];

      if (!isSelectedTrack && !isGhostVisible) continue;

      const trackColor = getTrackColor(track.id);

      for (const note of track.notes) {
        const noteX = note.timeStart * zoom - scrollLeft;
        const noteW = Math.max(note.duration * zoom, 2);
        const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT - scrollTop;

        if (noteX + noteW < 0 || noteX > width) continue;
        if (noteY + ROW_HEIGHT < 0 || noteY > height) continue;

        if (isSelectedTrack) {
          const isSelected = selectedNoteIds.has(note.id);
          ctx.fillStyle = isSelected ? '#ffb347' : trackColor;
          ctx.fillRect(noteX, noteY, noteW, ROW_HEIGHT - 1);

          ctx.strokeStyle = isSelected ? '#fff' : shadeColor(trackColor, -30);
          ctx.strokeRect(noteX, noteY, noteW, ROW_HEIGHT - 1);

          // Velocity bar
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(noteX, noteY + (ROW_HEIGHT - 4) / 2, noteW * note.velocity, 3);
        } else {
          // Ghost note
          ctx.strokeStyle = trackColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(noteX, noteY, noteW, ROW_HEIGHT - 1);
          ctx.fillStyle = shadeColor(trackColor, -150); // very dark
          ctx.fillRect(noteX + 1, noteY + 1, noteW - 2, ROW_HEIGHT - 3);
        }
      }
    }

    // 4. Fade animations
    for (const anim of fadeAnimations.current) {
      const animX = anim.x - scrollLeft;
      if (animX + anim.w < 0 || animX > width) continue;
      ctx.fillStyle = `rgba(255, 85, 85, ${anim.opacity})`;
      ctx.fillRect(animX, anim.y, anim.w, anim.h);
    }
  }, []);

  useEffect(() => {
    drawBgCanvasRef.current = drawBgCanvas;
  }, [drawBgCanvas]);

  const drawFgCanvas = useCallback(() => {
    const canvas = fgCanvasRef.current;
    const tCanvas = timelineFgRef.current;
    if (!canvas || !tCanvas) return;
    const ctx = canvas.getContext('2d');
    const tCtx = tCanvas.getContext('2d');
    if (!ctx || !tCtx) return;

    const store = useLevelEditorStore.getState();
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const zoom = store.zoomLevel;
    const scrollLeft = store.scrollLeft;

    ctx.clearRect(0, 0, width, height);
    tCtx.clearRect(0, 0, width, TIMELINE_HEIGHT);

    // 1. Playhead
    const playheadX = store.playbackPosition * zoom - scrollLeft;
    if (playheadX >= -2 && playheadX <= width + 2) {
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      tCtx.strokeStyle = '#ffcc00';
      tCtx.lineWidth = 2;
      tCtx.beginPath();
      tCtx.moveTo(playheadX, 0);
      tCtx.lineTo(playheadX, TIMELINE_HEIGHT);
      tCtx.stroke();
    }

    // Anchor
    const anchorX = store.playbackAnchor * zoom - scrollLeft;
    if (anchorX >= -5 && anchorX <= width + 5) {
      tCtx.fillStyle = 'rgba(255, 204, 0, 0.3)';
      tCtx.beginPath();
      tCtx.moveTo(anchorX - 5, 0);
      tCtx.lineTo(anchorX + 5, 0);
      tCtx.lineTo(anchorX, 8);
      tCtx.fill();
    }

    // End Position Marker
    const endX = store.chartEndPosition * zoom - scrollLeft;
    if (endX >= -10 && endX <= width + 10) {
      tCtx.fillStyle = '#ff4444';
      tCtx.beginPath();
      tCtx.moveTo(endX - 8, 0);
      tCtx.lineTo(endX + 8, 0);
      tCtx.lineTo(endX, 12);
      tCtx.fill();

      ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    }

    // 2. Marquee
    if (isMarqueeSelecting.current) {
      ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 1;
      const x = Math.min(marqueeStart.current.x, marqueeEnd.current.x) - scrollLeft;
      const y = Math.min(marqueeStart.current.y, marqueeEnd.current.y);
      const w = Math.abs(marqueeEnd.current.x - marqueeStart.current.x);
      const h = Math.abs(marqueeEnd.current.y - marqueeStart.current.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
  }, []);

  // --- Playback loop ---

  const playbackLoop = useCallback(() => {
    const store = useLevelEditorStore.getState();
    if (!store.isPlaying) return;

    const elapsed = (performance.now() - playbackStartWallTime.current) / 1000;
    const newPos = store.playbackAnchor + elapsed;

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
          if (note.timeStart * 1000 > oldPosMs && note.timeStart * 1000 <= newPosMs) {
            const noteName = pitchToName(note.pitch);
            // Apply track velocity and store's overall MIDI volume
            const finalVelocity = note.velocity * (store.midiVolume / 100);
            playNote(noteName, finalVelocity);
          }
        }
      }
    }

    useLevelEditorStore.setState({ playbackPosition: newPos });
    drawFgCanvas();
    playbackRafId.current = requestAnimationFrame(playbackLoop);
  }, [drawFgCanvas]);

  // --- Canvas sizing ---

  const resizeCanvases = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const viewportW = wrapper.clientWidth - KEYBOARD_WIDTH;
    const viewportH = wrapper.clientHeight - TIMELINE_HEIGHT;

    const setSize = (canvas: HTMLCanvasElement | null, w: number, h: number) => {
      if (!canvas) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx?.resetTransform();
      ctx?.scale(dpr, dpr);
    };

    setSize(bgCanvasRef.current, viewportW, viewportH);
    setSize(fgCanvasRef.current, viewportW, viewportH);
    setSize(timelineBgRef.current, viewportW, TIMELINE_HEIGHT);
    setSize(timelineFgRef.current, viewportW, TIMELINE_HEIGHT);

    drawBgCanvas();
    drawFgCanvas();
  }, [drawBgCanvas, drawFgCanvas]);

  // --- Mouse interaction helpers ---

  const getMouseCoords = useCallback((e: MouseEvent, forceTimeline = false) => {
    const fg = fgCanvasRef.current;
    const tFg = timelineFgRef.current;
    if (!fg || !tFg) return { x: 0, y: 0, isTimeline: false };

    const target = e.target as HTMLElement;
    let isTimeline = forceTimeline || target === tFg || target === timelineBgRef.current;
    if (dragAction.current === 'scrub') isTimeline = true;

    const rect = isTimeline ? tFg.getBoundingClientRect() : fg.getBoundingClientRect();
    const store = useLevelEditorStore.getState();

    const x = (e.clientX - rect.left) + store.scrollLeft;
    const y = (e.clientY - rect.top);
    return { x, y, isTimeline };
  }, []);

  const getHitTarget = useCallback((x: number, y: number, isTimeline: boolean) => {
    if (isTimeline) {
      const store = useLevelEditorStore.getState();

      const endX = store.chartEndPosition * store.zoomLevel;
      if (x >= endX - 10 && x <= endX + 10) {
        return { type: 'chart-end-pos' as const };
      }

      const track = store.getCurrentTrack();
      if (track && store.selectedNoteIds.size > 1) {
        const selectedNotes = track.notes.filter(n => store.selectedNoteIds.has(n.id));
        const trackMaxTime = Math.max(...selectedNotes.map(n => n.timeStart + n.duration));
        if (trackMaxTime > 0) {
          const stretchX = trackMaxTime * store.zoomLevel;
          if (x >= stretchX - 12 && x <= stretchX + 12) {
            return { type: 'stretch-midi' as const, trackMaxTime };
          }
        }
      }
      return { type: 'timeline' as const };
    }

    const store = useLevelEditorStore.getState();
    const track = store.getCurrentTrack();
    if (!track) return { type: 'none' as const };

    const zoom = store.zoomLevel;
    const scrollTop = store.scrollTop;

    for (let i = track.notes.length - 1; i >= 0; i--) {
      const note = track.notes[i];
      const noteX = note.timeStart * zoom;
      const noteW = Math.max(note.duration * zoom, 2);
      const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT - scrollTop;

      if (x >= noteX && x <= noteX + noteW && y >= noteY && y <= noteY + ROW_HEIGHT) {
        const edgeThreshold = 4;
        if (x <= noteX + edgeThreshold) return { type: 'resize-left' as const, note };
        if (x >= noteX + noteW - edgeThreshold) return { type: 'resize-right' as const, note };
        return { type: 'note' as const, note };
      }
    }
    return { type: 'empty' as const };
  }, []);

  // --- Mouse handlers ---
  const wasPlayingRef = useRef(false);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const store = useLevelEditorStore.getState();

    // Middle click for panning
    if (e.button === 1) {
      e.preventDefault();
      isMiddlePanning.current = true;
      panStartMouseX.current = e.clientX;
      panStartMouseY.current = e.clientY;
      panStartScrollX.current = store.scrollLeft;
      panStartScrollY.current = store.scrollTop;
      document.body.style.cursor = 'grabbing';
      return;
    }

    const { x, y, isTimeline } = getMouseCoords(e);
    const target = getHitTarget(x, y, isTimeline);

    if (target.type === 'chart-end-pos') {
      if (e.button === 0) {
        dragAction.current = 'move-end-pos';
      }
      return;
    }

    if (target.type === 'timeline') {
      if (e.button === 0) {
        wasPlayingRef.current = store.isPlaying;
        if (store.isPlaying) store.stopPlayback();
        store.setPlaybackAnchor(x / store.zoomLevel);
        dragAction.current = 'scrub';
      }
      return;
    }

    if (target.type === 'stretch-midi') {
      if (e.button === 0) {
        dragAction.current = 'stretch-midi';
        dragStartMouseX.current = x;
        dragStartNotes.current.clear();
        const track = store.getCurrentTrack();
        if (track) {
          track.notes.forEach(n => {
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

    if (e.button === 0) { // Left Click
      if (e.ctrlKey) {
        // Start marquee
        isMarqueeSelecting.current = true;
        marqueeStart.current = { x, y };
        marqueeEnd.current = { x, y };
        dragAction.current = 'none';
        return;
      }

      if (target.type === 'note' || target.type === 'resize-left' || target.type === 'resize-right') {
        const note = target.note!;
        if (!store.selectedNoteIds.has(note.id)) {
          store.selectNote(note.id, e.shiftKey);
        } else if (e.shiftKey) {
          store.deselectNote(note.id);
          return;
        }

        dragTargetNoteId.current = note.id;
        dragStartMouseX.current = x;
        dragStartMouseY.current = y;
        dragCurrentPitch.current = note.pitch;

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

        if (target.type === 'note') dragAction.current = 'move';
        else if (target.type === 'resize-left') dragAction.current = 'resize-left';
        else dragAction.current = 'resize-right';

        // Preview sound
        playNote(pitchToName(note.pitch), note.velocity);
      } else if (target.type === 'empty') {
        // Add new note
        const zoom = store.zoomLevel;
        const pitch = MAX_PITCH - Math.floor((y + store.scrollTop) / ROW_HEIGHT);
        const timeStart = x / zoom;
        const duration = lastNoteDuration.current;

        const newNote: EditorNote = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          pitch: Math.max(0, Math.min(MAX_PITCH, pitch)),
          name: pitchToName(Math.max(0, Math.min(MAX_PITCH, pitch))),
          timeStart,
          duration,
          velocity: 0.8,
        };

        if (!e.shiftKey) store.clearSelection();
        store.addNote(newNote);
        store.selectNote(newNote.id);

        playNote(newNote.name, 0.8);

        // Start drag for the new note
        dragTargetNoteId.current = newNote.id;
        dragStartMouseX.current = x;
        dragStartMouseY.current = y;
        dragAction.current = 'move';
        dragCurrentPitch.current = newNote.pitch;
        dragStartNotes.current.clear();
        dragStartNotes.current.set(newNote.id, {
          timeStart: newNote.timeStart,
          duration: newNote.duration,
          pitch: newNote.pitch,
        });
      }
    } else if (e.button === 2) { // Right click = erase
      dragAction.current = 'erase';
      if (target.type === 'note' || target.type === 'resize-left' || target.type === 'resize-right') {
        const note = target.note!;
        const noteX = note.timeStart * store.zoomLevel;
        const noteW = Math.max(note.duration * store.zoomLevel, 2);
        const noteY = (MAX_PITCH - note.pitch) * ROW_HEIGHT;
        startFadeAnimation(noteX, noteY, noteW, ROW_HEIGHT - 1);
        store.removeNote(note.id);
      }
    }
  }, [getMouseCoords, getHitTarget]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const store = useLevelEditorStore.getState();

    if (isMiddlePanning.current) {
      const dx = e.clientX - panStartMouseX.current;
      const dy = e.clientY - panStartMouseY.current;
      store.setScrollLeft(panStartScrollX.current - dx);
      store.setScrollTop(panStartScrollY.current - dy);
      drawBgCanvas();
      drawFgCanvas();
      return;
    }

    const { x, y, isTimeline } = getMouseCoords(e);

    // Update cursor on hover
    if (dragAction.current === 'none' && !isMarqueeSelecting.current && !isMiddlePanning.current) {
      const target = getHitTarget(x, y, isTimeline);
      let cursor = 'crosshair';
      if (target.type === 'resize-left' || target.type === 'resize-right' || target.type === 'stretch-midi' || target.type === 'chart-end-pos') cursor = 'ew-resize';
      else if (target.type === 'note') cursor = 'move';
      else if (target.type === 'timeline') cursor = 'pointer';
      
      const fgCanvas = fgCanvasRef.current;
      const tFgCanvas = timelineFgRef.current;
      if (isTimeline && tFgCanvas) tFgCanvas.style.cursor = cursor;
      else if (!isTimeline && fgCanvas) fgCanvas.style.cursor = cursor;
    }

    if (dragAction.current === 'scrub') {
      store.setPlaybackAnchor(x / store.zoomLevel);
      drawFgCanvas();
      return;
    }

    if (dragAction.current === 'move-end-pos') {
      store.setChartEndPosition(x / store.zoomLevel);
      drawFgCanvas();
      return;
    }

    if (isMarqueeSelecting.current) {
      marqueeEnd.current = { x, y };
      drawFgCanvas();
      return;
    }

    if (dragAction.current === 'erase') {
      const eraseTarget = getHitTarget(x, y, isTimeline);
      if (eraseTarget.type === 'note' || eraseTarget.type === 'resize-left' || eraseTarget.type === 'resize-right') {
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

    if (dragAction.current !== 'none') {
      const dxTime = (x - dragStartMouseX.current) / store.zoomLevel;
      const dyRows = Math.floor((y - dragStartMouseY.current) / ROW_HEIGHT);

      const updates: { id: string; changes: Partial<EditorNote> }[] = [];
      let pitchChanged = false;
      let primaryNewPitch = dragCurrentPitch.current;

      if (dragAction.current === 'stretch-midi') {
        const dxTime = (x - dragStartMouseX.current) / store.zoomLevel;
        const origMinTime = Math.min(...Array.from(dragStartNotes.current.values()).map(n => n.timeStart));
        const origMaxTime = Math.max(origMinTime + 0.01, ...Array.from(dragStartNotes.current.values()).map(n => n.timeStart + n.duration));
        const origDuration = origMaxTime - origMinTime;
        const newMaxTime = Math.max(origMinTime + 0.01, origMaxTime + dxTime);
        const newDuration = newMaxTime - origMinTime;
        const ratio = newDuration / origDuration;

        const track = store.getCurrentTrack();
        if (track) {
          track.notes.forEach(n => {
            const orig = dragStartNotes.current.get(n.id);
            if (orig) {
              updates.push({
                id: n.id,
                changes: {
                  timeStart: origMinTime + (orig.timeStart - origMinTime) * ratio,
                  duration: orig.duration * ratio
                }
              });
            }
          });
        }
      } else {
        store.selectedNoteIds.forEach(noteId => {
          const orig = dragStartNotes.current.get(noteId);
          if (!orig) return;

          if (dragAction.current === 'move') {
            let newPitch = orig.pitch - dyRows;
            newPitch = Math.max(0, Math.min(MAX_PITCH, newPitch));
            const newTime = Math.max(0, orig.timeStart + dxTime);
            updates.push({ id: noteId, changes: { timeStart: newTime, pitch: newPitch, name: pitchToName(newPitch) } });

            if (noteId === dragTargetNoteId.current && newPitch !== dragCurrentPitch.current) {
              primaryNewPitch = newPitch;
              pitchChanged = true;
            }
          } else if (dragAction.current === 'resize-right') {
            const newDuration = Math.max(0.01, orig.duration + dxTime);
            updates.push({ id: noteId, changes: { duration: newDuration } });
            if (noteId === dragTargetNoteId.current) lastNoteDuration.current = newDuration;
          } else if (dragAction.current === 'resize-left') {
            const maxDx = orig.duration - 0.01;
            const actualDx = Math.min(dxTime, maxDx);
            const newTime = Math.max(0, orig.timeStart + actualDx);
            const newDuration = orig.duration - actualDx;
            updates.push({ id: noteId, changes: { timeStart: newTime, duration: newDuration } });
            if (noteId === dragTargetNoteId.current) lastNoteDuration.current = newDuration;
          }
        });
      }

      if (updates.length > 0) {
        store.updateNotes(updates, false);
        drawBgCanvas();

        if (pitchChanged) {
          dragCurrentPitch.current = primaryNewPitch;
          playNote(pitchToName(primaryNewPitch));
        }
      }
    }
  }, [getMouseCoords, getHitTarget, drawBgCanvas, drawFgCanvas]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    if (isMiddlePanning.current) {
      isMiddlePanning.current = false;
      document.body.style.cursor = '';
      return;
    }

    const store = useLevelEditorStore.getState();

    if (dragAction.current === 'scrub') {
      if (wasPlayingRef.current && !useLevelEditorStore.getState().isPlaying) {
        useLevelEditorStore.getState().togglePlayback();
      }
      dragAction.current = 'none';
      return;
    }

    if (dragAction.current !== 'none') {
      dragAction.current = 'none';
      store.commitHistory();
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
        if (!e.shiftKey) store.clearSelection();

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
  }, [handleMouseMove, drawBgCanvas, drawFgCanvas]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    handleMouseDown(e);
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  // --- Wheel zoom / scroll ---

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const store = useLevelEditorStore.getState();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const zoomDelta = e.deltaY > 0 ? -10 : 10;
      const newZoom = Math.max(10, Math.min(1000, store.zoomLevel + zoomDelta));
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
      store.setScrollTop(store.scrollTop + e.deltaY);
    }

    resizeCanvases();
  }, [resizeCanvases]);

  // --- Keyboard shortcuts ---

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    const store = useLevelEditorStore.getState();

    if (e.key === ' ') {
      e.preventDefault();
      store.togglePlayback();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        store.selectAll();
        drawBgCanvas();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        store.copySelectedNotes();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        store.pasteNotes(store.playbackAnchor);
        drawBgCanvas();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        drawBgCanvas();
        drawFgCanvas();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        store.redo();
        drawBgCanvas();
        drawFgCanvas();
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const track = store.getCurrentTrack();
      if (track) {
        track.notes.forEach(note => {
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
    }
  }, [drawBgCanvas, drawFgCanvas]);

  // --- Subscriptions & lifecycle ---

  useEffect(() => {
    resizeCanvases();

    const observer = new ResizeObserver(() => resizeCanvases());
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    window.addEventListener('keydown', handleKeyDown);

    // Subscribe to store changes for redraw
    const unsub = useLevelEditorStore.subscribe((state, prevState) => {
      if (
        state.midiData !== prevState.midiData ||
        state.selectedNoteIds !== prevState.selectedNoteIds ||
        state.selectedTrackId !== prevState.selectedTrackId ||
        state.scrollLeft !== prevState.scrollLeft ||
        state.scrollTop !== prevState.scrollTop ||
        state.zoomLevel !== prevState.zoomLevel ||
        state.ghostNoteVisibility !== prevState.ghostNoteVisibility
      ) {
        drawBgCanvas();
        drawFgCanvas();
      }
      if (state.playbackPosition !== prevState.playbackPosition ||
          state.playbackAnchor !== prevState.playbackAnchor ||
          state.chartEndPosition !== prevState.chartEndPosition) {
        drawFgCanvas();
      }

      // Handle playback start/stop
      if (state.isPlaying && !prevState.isPlaying) {
        playbackStartWallTime.current = performance.now();
        playbackRafId.current = requestAnimationFrame(playbackLoop);
      } else if (!state.isPlaying && prevState.isPlaying) {
        cancelAnimationFrame(playbackRafId.current);
        drawFgCanvas();
      }
    });

    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(playbackRafId.current);
      cancelAnimationFrame(fadeRafId.current);
      unsub();
    };
  }, [resizeCanvases, handleKeyDown, drawBgCanvas, drawFgCanvas, playbackLoop]);

  // Add wheel handler after mount (passive: false required)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('wheel', handleWheel, { passive: false });
      return () => wrapper.removeEventListener('wheel', handleWheel);
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
              style={{ cursor: 'pointer' }}
              onMouseDown={(e) => onMouseDown(e.nativeEvent)}
              onMouseMove={(e) => {
                if (dragAction.current === 'none' && !isMarqueeSelecting.current && !isMiddlePanning.current) {
                  handleMouseMove(e.nativeEvent);
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>

          {/* Keyboard */}
          <PianoRollKeyboard scrollTop={store.scrollTop} height={wrapperRef.current?.clientHeight ?? 800} />

          {/* Canvas area */}
          <div
            className="pr-canvas-container"
            style={{ left: KEYBOARD_WIDTH, top: TIMELINE_HEIGHT }}
          >
            <canvas ref={bgCanvasRef} className="pr-canvas-bg" />
            <canvas
              ref={fgCanvasRef}
              className="pr-canvas-fg"
              style={{ cursor: 'crosshair' }}
              onMouseDown={(e) => onMouseDown(e.nativeEvent)}
              onMouseMove={(e) => {
                if (dragAction.current === 'none' && !isMarqueeSelecting.current && !isMiddlePanning.current) {
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
