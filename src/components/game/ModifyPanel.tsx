import React, { useState, useRef, useEffect } from "react";
import { RefreshCw, Eye, EyeOff, Wrench } from "lucide-react";
import { FloatingWindow } from "../ui/FloatingWindow";
import { TrackPreviewCanvas } from "./TrackPreviewCanvas";
import type { MidiTrackInfo, MonophonicMethod } from "../../utils/midiUtils";
import { autoArrangeBlocks } from "../../utils/autoArrange";
import { useGameStore } from "../../store/useGameStore";
import { useStore } from "../../store/useStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModifyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  midiTrackInfos: MidiTrackInfo[];
  trackMode: Map<number, "interactive" | "background" | "off">;
  onTrackModeChange: (trackIndex: number, mode: "interactive" | "background" | "off") => void;
  onMonophonize: (trackIndex: number, method: MonophonicMethod) => void;
  currentMidiFile: File | null;
  onReimport: () => void;
  gridCols: number;
  setGridCols: React.Dispatch<React.SetStateAction<number>>;
}

let savedPos: { x: number; y: number } | undefined;

// ─── TrackRow ─────────────────────────────────────────────────────────────────

interface TrackRowProps {
  info: MidiTrackInfo;
  mode: "interactive" | "background" | "off";
  onModeChange: (m: "interactive" | "background" | "off") => void;
  previewOpen: boolean;
  onTogglePreview: () => void;
  wrenchOpen: boolean;
  onWrenchClick: (rect: DOMRect) => void;
}

const TrackRow: React.FC<TrackRowProps> = ({
  info,
  mode,
  onModeChange,
  previewOpen,
  onTogglePreview,
  wrenchOpen,
  onWrenchClick,
}) => {
  const wrenchBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <div style={{ marginBottom: previewOpen ? 0 : 4 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 10,
              background: "rgba(99,102,241,0.2)",
              fontSize: 11,
              color: "#a5b4fc",
              flexShrink: 0,
            }}
          >
            {info.instrument}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: "var(--text-primary)",
              flex: 1,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {info.name}
            {info.suggestInteractive && (
              <span style={{ marginLeft: 5, fontSize: 10, color: "#6366f1" }}>★</span>
            )}
          </span>
          <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>{info.noteCount}</span>

          {/* Wrench button */}
          <button
            ref={wrenchBtnRef}
            onClick={() => {
              const rect = wrenchBtnRef.current?.getBoundingClientRect();
              if (rect) onWrenchClick(rect);
            }}
            title="Monophonize track"
            style={{
              background: wrenchOpen ? "rgba(99,102,241,0.3)" : "transparent",
              border: "1px solid rgba(99,102,241,0.35)",
              color: wrenchOpen ? "#a5b4fc" : "rgba(255,255,255,0.4)",
              borderRadius: 4,
              padding: "2px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!wrenchOpen) e.currentTarget.style.background = "rgba(99,102,241,0.15)";
            }}
            onMouseLeave={(e) => {
              if (!wrenchOpen) e.currentTarget.style.background = "transparent";
            }}
          >
            <Wrench size={13} />
          </button>

          {/* Preview button */}
          <button
            onClick={onTogglePreview}
            title={previewOpen ? "Close preview" : "Preview track"}
            style={{
              background: previewOpen ? "rgba(99,102,241,0.3)" : "transparent",
              border: "1px solid rgba(99,102,241,0.35)",
              color: previewOpen ? "#a5b4fc" : "rgba(255,255,255,0.4)",
              borderRadius: 4,
              padding: "2px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!previewOpen) e.currentTarget.style.background = "rgba(99,102,241,0.15)";
            }}
            onMouseLeave={(e) => {
              if (!previewOpen) e.currentTarget.style.background = "transparent";
            }}
          >
            {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        {/* Mode toggles */}
        <div className="toggle-group">
          {(["interactive", "background", "off"] as const).map((m) => (
            <button
              key={m}
              className={`toggle-btn ${mode === m ? "active" : ""}`}
              onClick={() => onModeChange(m)}
            >
              {m === "interactive" ? "Interactive" : m === "background" ? "Background" : "Off"}
            </button>
          ))}
        </div>
      </div>

      {/* Inline piano-roll preview */}
      {previewOpen && (
        <TrackPreviewCanvas
          notes={info.notes}
          instrument={info.instrument}
          duration={info.duration}
          onClose={onTogglePreview}
        />
      )}
    </div>
  );
};

// ─── ModifyPanel ──────────────────────────────────────────────────────────────

export const ModifyPanel: React.FC<ModifyPanelProps> = ({
  isOpen,
  onClose,
  midiTrackInfos,
  trackMode,
  onTrackModeChange,
  onMonophonize,
  currentMidiFile,
  onReimport,
  gridCols,
  setGridCols,
}) => {
  const [activeTab, setActiveTab] = useState<"tracks" | "arrange">("tracks");
  const [previewTrackIndex, setPreviewTrackIndex] = useState<number | null>(null);
  const [wrenchOpenIndex, setWrenchOpenIndex] = useState<number | null>(null);
  const [wrenchPos, setWrenchPos] = useState({ x: 0, y: 0 });
  const wrenchPopupRef = useRef<HTMLDivElement>(null);

  const blockCount = useGameStore((s) => s.blocks.length);

  // Close wrench popup on outside click
  useEffect(() => {
    if (wrenchOpenIndex === null) return;
    const close = (e: MouseEvent) => {
      if (!wrenchPopupRef.current?.contains(e.target as Node)) {
        setWrenchOpenIndex(null);
      }
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [wrenchOpenIndex]);

  const handleWrenchClick = (trackIndex: number, rect: DOMRect) => {
    if (wrenchOpenIndex === trackIndex) {
      setWrenchOpenIndex(null);
    } else {
      setWrenchOpenIndex(trackIndex);
      setWrenchPos({ x: Math.max(8, rect.right - 208), y: rect.bottom + 4 });
    }
  };

  const handleArrange = (mode: "grid" | "pitch" | "smart") => {
    const gs = useGameStore.getState();
    const newBlocks = autoArrangeBlocks(gs.blocks, gs.gameEvents, mode, gridCols);
    gs.setBlocks(newBlocks);
    gs.commitHistory();
    const label = mode === "grid" ? "Grid" : mode === "pitch" ? "By Pitch" : "Smart";
    useStore.getState().showToast(`Arranged: ${label}`);
  };

  return (
    <>
      <FloatingWindow
        title="Modify"
        isOpen={isOpen}
        onClose={onClose}
        initialPosition={savedPos ?? { x: Math.round(window.innerWidth - 400), y: 80 }}
        initialSize={{ width: 360, height: "auto" }}
        minSize={{ width: 300, height: 200 }}
        onPositionChange={(pos) => { savedPos = pos; }}
        style={{ maxHeight: "80vh" }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "2px solid rgba(255,255,255,0.08)",
            marginBottom: 14,
            flexShrink: 0,
          }}
        >
          {(["tracks", "arrange"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "8px 0",
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
                marginBottom: -2,
                color: activeTab === tab ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                fontWeight: activeTab === tab ? 700 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "color 0.15s",
                textTransform: "capitalize",
              }}
            >
              {tab === "tracks" ? "Tracks" : "Arrange"}
            </button>
          ))}
        </div>

        <div
          className="outliner-content"
          style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}
        >
          {/* ── TRACKS TAB ── */}
          {activeTab === "tracks" && (
            <>
              {midiTrackInfos.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    textAlign: "center",
                    padding: "24px 0",
                    opacity: 0.55,
                  }}
                >
                  Import a MIDI file to see tracks.
                </div>
              ) : (
                <>
                  {/* Re-import at top */}
                  {currentMidiFile && (
                    <button
                      className="primary-btn"
                      style={{
                        width: "100%",
                        padding: "7px",
                        borderRadius: 8,
                        fontWeight: "bold",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                      onClick={onReimport}
                    >
                      <RefreshCw size={14} />
                      Re-import
                    </button>
                  )}

                  {midiTrackInfos.map((info) => (
                    <TrackRow
                      key={info.index}
                      info={info}
                      mode={trackMode.get(info.index) ?? "off"}
                      onModeChange={(m) => onTrackModeChange(info.index, m)}
                      previewOpen={previewTrackIndex === info.index}
                      onTogglePreview={() =>
                        setPreviewTrackIndex((prev) =>
                          prev === info.index ? null : info.index,
                        )
                      }
                      wrenchOpen={wrenchOpenIndex === info.index}
                      onWrenchClick={(rect) => handleWrenchClick(info.index, rect)}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* ── ARRANGE TAB ── */}
          {activeTab === "arrange" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ color: "var(--text-primary)", fontSize: 13, flex: 1 }}>Columns</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={gridCols}
                  onChange={(e) =>
                    setGridCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    width: 56,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "rgba(0,0,0,0.3)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--panel-border)",
                    fontSize: 14,
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                <span style={{ color: "var(--text-secondary)", fontSize: 12, flexShrink: 0 }}>
                  {blockCount > 0 ? Math.ceil(blockCount / gridCols) : 0} rows
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(
                  [
                    { key: "grid", label: "Grid", desc: "Uniform grid layout" },
                    { key: "pitch", label: "By Pitch", desc: "Sort low → high, then grid" },
                    {
                      key: "smart",
                      label: "Smart (Min Distance)",
                      desc: "Minimize cursor travel using N-gram analysis",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    style={{
                      padding: "9px 12px",
                      background: "rgba(99,102,241,0.08)",
                      color: "var(--text-primary)",
                      border: "1px solid rgba(99,102,241,0.25)",
                      borderRadius: 8,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(99,102,241,0.22)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "rgba(99,102,241,0.08)")
                    }
                    onClick={() => handleArrange(opt.key)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </FloatingWindow>

      {/* Monophonize popup — rendered outside FloatingWindow so it clears overflow */}
      {wrenchOpenIndex !== null && (
        <div
          ref={wrenchPopupRef}
          style={{
            position: "fixed",
            left: wrenchPos.x,
            top: wrenchPos.y,
            zIndex: 9999,
            background: "var(--panel-bg, #1a1a2e)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--panel-border, rgba(255,255,255,0.12))",
            borderRadius: 10,
            padding: 8,
            width: 208,
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              padding: "4px 6px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 6,
            }}
          >
            Monophonize
          </div>
          {(
            [
              { method: "timeSlice", label: "Time Slice", desc: "Highest note per time window" },
              { method: "chordCollapse", label: "Chord Collapse", desc: "Melody note from each chord" },
              { method: "voiceSeparation", label: "Voice Separation", desc: "Follow melodic continuity" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.method}
              onClick={() => {
                onMonophonize(wrenchOpenIndex, opt.method);
                setWrenchOpenIndex(null);
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                background: "transparent",
                border: "none",
                borderRadius: 6,
                textAlign: "left",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(99,102,241,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
};
