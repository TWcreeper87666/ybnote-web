import React from "react";
import { X } from "lucide-react";
import type { MidiTrackInfo } from "../../utils/midiUtils";

interface Props {
  trackInfos: MidiTrackInfo[];
  trackMode: Map<number, "interactive" | "background" | "off">;
  setTrackMode: React.Dispatch<
    React.SetStateAction<Map<number, "interactive" | "background" | "off">>
  >;
  onConfirm: () => void;
  onClose: () => void;
}

export const TrackSelectionModal: React.FC<Props> = ({
  trackInfos,
  trackMode,
  setTrackMode,
  onConfirm,
  onClose,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.85)",
      zIndex: 25,
    }}
    onPointerDown={(e) => e.stopPropagation()}
    onWheel={(e) => e.stopPropagation()}
  >
    <div
      className="glass-panel"
      style={{
        width: 480,
        maxWidth: "90vw",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="settings-header" style={{ padding: "16px 20px", flexShrink: 0 }}>
        <h2 style={{ color: "var(--text-primary)", margin: 0 }}>Select MIDI Tracks</h2>
        <button className="icon-btn icon-btn-round" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {/* Track list */}
      <div className="settings-body" style={{ padding: "0 20px 16px", overflowY: "auto" }}>
        {trackInfos.map((info) => (
          <div
            key={info.index}
            className="settings-row"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(99,102,241,0.2)",
                  fontSize: 12,
                  color: "#a5b4fc",
                  flexShrink: 0,
                }}
              >
                {info.instrument}
              </span>
              <span
                style={{ fontWeight: 600, color: "var(--text-primary)", flex: 1 }}
              >
                {info.name}
                {info.suggestInteractive && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "#6366f1" }}>
                    ★ suggested
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{info.noteCount} notes</span>
            </div>
            <div className="toggle-group">
              {(["interactive", "background", "off"] as const).map((m) => (
                <button
                  key={m}
                  className={`toggle-btn ${trackMode.get(info.index) === m ? "active" : ""}`}
                  onClick={() =>
                    setTrackMode((prev) => {
                      const next = new Map(prev);
                      next.set(info.index, m);
                      return next;
                    })
                  }
                >
                  {m === "interactive" ? "Interactive" : m === "background" ? "Background" : "Off"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--panel-border)",
          flexShrink: 0,
        }}
      >
        <button
          className="primary-btn"
          style={{ width: "100%", padding: "10px", borderRadius: 10, fontWeight: "bold" }}
          onClick={onConfirm}
        >
          Import
        </button>
      </div>
    </div>
  </div>
);
