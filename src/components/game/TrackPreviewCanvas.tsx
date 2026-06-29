import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import type { MidiTrackNote } from "../../utils/midiUtils";
import { playNote } from "../../utils/audio";

interface Props {
  notes: MidiTrackNote[];
  instrument: string;
  duration: number;
  onClose: () => void;
}

export const TrackPreviewCanvas: React.FC<Props> = ({
  notes,
  instrument,
  duration,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlayingState, setIsPlayingState] = useState(true);

  // All mutable playback state lives in a single ref to avoid closure staleness
  const stateRef = useRef({
    isPlaying: true,
    currentTime: 0,
    lastTick: Date.now(),
    nextNoteIdx: 0,
  });

  // Pre-sort once and derive pitch range
  const sortedNotes = useRef([...notes].sort((a, b) => a.time - b.time)).current;
  const midiNums = sortedNotes.map((n) => n.midi);
  const minMidi = (midiNums.length > 0 ? Math.min(...midiNums) : 60) - 2;
  const maxMidi = (midiNums.length > 0 ? Math.max(...midiNums) : 72) + 2;
  const midiRange = Math.max(1, maxMidi - minMidi);
  const effectiveDuration = Math.max(0.1, duration);

  // Stable refs so the single RAF closure can read latest values
  const paramsRef = useRef({ minMidi, midiRange, effectiveDuration, instrument, sortedNotes });
  paramsRef.current = { minMidi, midiRange, effectiveDuration, instrument, sortedNotes };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;   // 480 – canvas coordinate space
    const H = canvas.height;  // 72

    let rafId: number;

    const draw = () => {
      const { minMidi: mn, midiRange: mr, effectiveDuration: ed, instrument: instr, sortedNotes: sn } = paramsRef.current;
      const st = stateRef.current;
      const now = Date.now();

      if (st.isPlaying) {
        const dt = (now - st.lastTick) / 1000;
        st.currentTime += dt;

        // Fire due notes
        while (st.nextNoteIdx < sn.length && sn[st.nextNoteIdx].time <= st.currentTime) {
          const n = sn[st.nextNoteIdx];
          playNote(n.pitch, 0.35, instr);
          st.nextNoteIdx++;
        }

        // Loop
        if (st.currentTime >= ed) {
          st.currentTime = 0;
          st.nextNoteIdx = 0;
        }
      }
      st.lastTick = now;

      const timeToX = (t: number) => (t / ed) * (W - 2) + 1;
      const midiToY = (m: number) => H - 4 - ((m - mn) / mr) * (H - 8);

      // Background
      ctx.fillStyle = "#0b0b1c";
      ctx.fillRect(0, 0, W, H);

      // Subtle time grid
      const gridCount = Math.min(16, Math.ceil(ed));
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let i = 1; i < gridCount; i++) {
        const x = timeToX((i / gridCount) * ed);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      // Notes
      for (const note of sn) {
        const x = timeToX(note.time);
        const y = midiToY(note.midi);
        const w = Math.max(3, timeToX(note.time + note.duration) - x - 1);
        const hue = (note.midi % 12) * 30;
        const active = note.time <= st.currentTime && note.time + note.duration >= st.currentTime;
        ctx.fillStyle = active
          ? `hsla(${hue}, 85%, 78%, 1)`
          : `hsla(${hue}, 60%, 58%, 0.8)`;
        ctx.fillRect(x, y - 2, w, 4);
      }

      // Playhead glow + line
      const px = timeToX(st.currentTime);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(Math.max(0, px - 4), 0, 8, H);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(px - 1, 0, 2, H);

      rafId = requestAnimationFrame(draw);
    };

    stateRef.current.lastTick = Date.now();
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // single long-lived loop — all values accessed via refs

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const st = stateRef.current;
    const { effectiveDuration: ed, sortedNotes: sn } = paramsRef.current;
    st.currentTime = ratio * ed;
    const idx = sn.findIndex((n) => n.time >= st.currentTime);
    st.nextNoteIdx = idx === -1 ? sn.length : idx;
    st.lastTick = Date.now();
  };

  const togglePlay = () => {
    const st = stateRef.current;
    st.isPlaying = !st.isPlaying;
    if (st.isPlaying) st.lastTick = Date.now();
    setIsPlayingState(st.isPlaying);
  };

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(99,102,241,0.35)",
        background: "#0b0b1c",
      }}
    >
      <canvas
        ref={canvasRef}
        width={480}
        height={72}
        onClick={handleCanvasClick}
        style={{ display: "block", width: "100%", cursor: "crosshair" }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.35)",
        }}
      >
        <button
          onClick={togglePlay}
          style={{
            background: "rgba(99,102,241,0.25)",
            border: "none",
            color: "white",
            borderRadius: 4,
            padding: "2px 10px",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isPlayingState ? <Pause size={11} /> : <Play size={11} />}
          {isPlayingState ? "Pause" : "Play"}
        </button>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", flex: 1 }}>
          click to seek
        </span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.45)",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
