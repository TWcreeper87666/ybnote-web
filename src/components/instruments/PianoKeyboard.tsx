import React, { useRef, useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import { playNote } from "../../utils/audio";
import { X } from "lucide-react";
import { MELODIC_INSTRUMENTS } from "../../config/instruments";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const PianoKeyboard: React.FC = () => {
  const { mode, setMode } = useStore();
  const pianoKeysCount = 36;
  const keyboardRef = useRef<HTMLDivElement>(null);

  // 面板本身的拖曳狀態
  const [hasDragged, setHasDragged] = useState(false);
  const [pianoPos, setPianoPos] = useState({ x: 0, y: 0 });
  const [isDraggingPiano, setIsDraggingPiano] = useState(false);
  const [pianoDragOffset, setPianoDragOffset] = useState({ x: 0, y: 0 });

  const [instrument, setInstrument] = useState("piano");

  useEffect(() => {
    if (!isDraggingPiano) return;
    const move = (e: PointerEvent) =>
      setPianoPos({
        x: e.clientX - pianoDragOffset.x,
        y: e.clientY - pianoDragOffset.y,
      });
    const up = () => setIsDraggingPiano(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [isDraggingPiano, pianoDragOffset]);

  if (mode !== "piano") return null;

  const handlePianoHeaderDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    if (!hasDragged) {
      if (keyboardRef.current && keyboardRef.current.parentElement) {
        const rect = keyboardRef.current.parentElement.getBoundingClientRect();
        setPianoPos({ x: rect.left, y: rect.top });
        setPianoDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
      setHasDragged(true);
    } else {
      setPianoDragOffset({
        x: e.clientX - pianoPos.x,
        y: e.clientY - pianoPos.y,
      });
    }
    setIsDraggingPiano(true);
  };

  const handleKeyPointerDown = (e: React.PointerEvent, pitch: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.button === 2) {
      playNote(pitch, 1, instrument);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    } else if (e.button === 0) {
      playNote(pitch, 1, instrument);

      // 交由 KeyboardDragOverlay 處理拖曳
      useStore.getState().setActiveKeyboardDrag({
        pitch,
        instrument,
        initialX: e.clientX,
        initialY: e.clientY,
      });
    }
  };

  const handleKeyPointerEnter = (e: React.PointerEvent, pitch: string) => {
    if (e.buttons === 2) {
      playNote(pitch, 1, instrument);
    }
  };

  const renderKeys = () => {
    const keys = [];
    for (let i = 0; i < pianoKeysCount; i++) {
      const octave = 3 + Math.floor(i / 12);
      const note = NOTES[i % 12];
      const isBlack = note.includes("#");
      const pitch = `${note}${octave}`;

      if (isBlack) {
        keys.push(
          <div
            key={pitch}
            onPointerDown={(e) => handleKeyPointerDown(e, pitch)}
            onPointerEnter={(e) => handleKeyPointerEnter(e, pitch)}
            className="piano-key black-key"
          >
            <span className="key-label">{pitch}</span>
          </div>,
        );
      } else {
        keys.push(
          <div
            key={pitch}
            onPointerDown={(e) => handleKeyPointerDown(e, pitch)}
            onPointerEnter={(e) => handleKeyPointerEnter(e, pitch)}
            className="piano-key white-key"
          >
            <span className="key-label">{pitch}</span>
          </div>,
        );
      }
    }
    return keys;
  };

  return (
    <div
      className="piano-container glass-panel"
      style={
        hasDragged
          ? {
              position: "fixed",
              left: pianoPos.x,
              top: pianoPos.y,
              transform: "none",
              bottom: "auto",
            }
          : undefined
      }
    >
      <div
        className="piano-header"
        onPointerDown={handlePianoHeaderDown}
        style={{
          cursor: "move",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="piano-title">Virtual Piano (Drag keys to Canvas)</span>
        <div
          style={{ display: "flex", gap: "8px", alignItems: "center" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            style={{
              background: "rgba(0,0,0,0.5)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "4px",
              padding: "2px 4px",
              fontSize: "12px",
            }}
          >
            {MELODIC_INSTRUMENTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.icon} {i.label}
              </option>
            ))}
          </select>
          <button onClick={() => setMode("select")} className="icon-btn">
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        ref={keyboardRef}
        className="keyboard-keys"
        style={{ flexWrap: "nowrap" }}
      >
        {renderKeys()}
      </div>
    </div>
  );
};
