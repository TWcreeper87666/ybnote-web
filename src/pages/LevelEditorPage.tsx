import React, { useEffect } from "react";
import { useLevelEditorStore } from "../store/useLevelEditorStore";
import { useStore } from "../store/useStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { PianoRoll } from "../components/editor/PianoRoll";
import { LevelEditorToolbar } from "../components/editor/LevelEditorToolbar";
import { ChartingTab } from "../components/editor/ChartingTab";
import { CanvasProvider } from "../store/CanvasProvider";
import { WaveformView } from "../components/editor/WaveformView";
import { TrackPanel } from "../components/editor/TrackPanel";
import { parseMidiFile } from "../utils/midiImport";
import { FileDown } from "lucide-react";
import { Toolbar } from "../components/ui/Toolbar";
import { SettingsPanel } from "../components/ui/SettingsPanel";
import { SelectionPropertiesHud } from "../components/ui/SelectionPropertiesHud";
import { ContextMenu } from "../components/ui/ContextMenu";
import { HelpPanel } from "../components/ui/HelpPanel";
import { OutlinerPanel } from "../components/ui/OutlinerPanel";
import { PocketCanvasPanel } from "../components/ui/PocketCanvasPanel";
import { PocketDragOverlay } from "../components/ui/PocketDragOverlay";
import { PianoKeyboard } from "../components/instruments/PianoKeyboard";
import { DrumKeyboard } from "../components/instruments/DrumKeyboard";
import { CanvasPlayerBar } from "../components/ui/CanvasPlayerBar";
import { useShortcuts } from "../hooks/useShortcuts";
import { SharedCanvas } from "../components/canvas/SharedCanvas";

const ShortcutsEnabler = () => {
  useShortcuts("editor");
  return null;
};

const BlocksPlaybackSync = () => {
  React.useEffect(() => {
    let rafId: number;
    let lastPlayedIndex = 0;

    const tick = () => {
      const editorState = useLevelEditorStore.getState();
      if (editorState.isPlaying) {
        const events = editorState.gameEvents;
        const currentMs = editorState.playbackPosition * 1000;

        if (
          lastPlayedIndex > 0 &&
          events[lastPlayedIndex - 1]?.time > currentMs
        ) {
          lastPlayedIndex = events.findIndex((e) => e.time >= currentMs);
          if (lastPlayedIndex === -1) lastPlayedIndex = events.length;
        }

        while (
          lastPlayedIndex < events.length &&
          events[lastPlayedIndex].time <= currentMs
        ) {
          const ev = events[lastPlayedIndex];
          const block = editorState.blocks.find((b) => b.id === ev.blockId);
          if (block) {
            editorState.updateBlock(ev.blockId, { playedAt: Date.now() });
          } else {
            const gr = useStore
              .getState()
              .groupRects.find((g) => g.id === ev.blockId);
            if (gr)
              useStore
                .getState()
                .updateGroupRect(ev.blockId, { playedAt: Date.now() });
          }
          lastPlayedIndex++;
        }
      } else {
        const events = editorState.gameEvents;
        const currentMs = editorState.playbackPosition * 1000;
        const idx = events.findIndex((e) => e.time >= currentMs);
        lastPlayedIndex = idx !== -1 ? idx : events.length;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return null;
};

const GlobalPlayhead = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let rafId: number;
    const update = () => {
      if (ref.current) {
        const state = useLevelEditorStore.getState();
        const x = state.playbackPosition * state.zoomLevel - state.scrollLeft;
        ref.current.style.transform = `translateX(${x}px)`;
        ref.current.style.opacity = x < 0 ? "0" : "1";
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 60,
        right: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        ref={ref}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 2,
          backgroundColor: "#ffcc00",
          boxShadow: "0 0 6px rgba(255, 204, 0, 0.6)",
        }}
      />
    </div>
  );
};

export const LevelEditorPage: React.FC = () => {
  const { activeTab } = useLevelEditorStore();
  const { theme } = useSettingsStore();
  const setMode = useStore((s) => s.setMode);
  const store = useLevelEditorStore();

  const [trackPanelWidth, setTrackPanelWidth] = React.useState(250);
  const [waveformHeight, setWaveformHeight] = React.useState(128);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragState = React.useRef<{
    type: string;
    startX: number;
    startY: number;
    initialW: number;
    initialH: number;
  } | null>(null);

  useEffect(() => {
    if (activeTab === "blocks" || activeTab === "charting") {
      setMode("select");
      const midiData = useLevelEditorStore.getState().midiData;
      if (midiData) {
        import("../utils/midiUtils").then(
          ({ parseParsedMidiDataToPocketBlocks }) => {
            parseParsedMidiDataToPocketBlocks(midiData);
          },
        );
      }
    }
  }, [activeTab, setMode]);

  // Prevent global browser zoom via Ctrl+Wheel
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", preventZoom, { passive: false });
    return () => window.removeEventListener("wheel", preventZoom);
  }, []);

  // Resizer logic
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { type, startX, startY, initialW, initialH } = dragState.current;

      if (type === "track") {
        const dx = e.clientX - startX;
        setTrackPanelWidth(Math.max(150, Math.min(800, initialW + dx)));
      } else if (type === "waveform") {
        const dy = e.clientY - startY;
        setWaveformHeight(Math.max(50, Math.min(500, initialH + dy)));
      }
    };

    const stopResize = () => {
      dragState.current = null;
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", stopResize);
      useLevelEditorStore.getState().stopPlayback();
    };
  }, []);

  const startResize = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    dragState.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialW: trackPanelWidth,
      initialH: waveformHeight,
    };
    document.body.style.cursor = type === "track" ? "ew-resize" : "ns-resize";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "mid" || ext === "midi") {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const parsed = await parseMidiFile(arrayBuffer);
          store.setMidiData(parsed);
        } catch (err) {
          console.error("Failed to parse MIDI", err);
          alert("Failed to parse MIDI file");
        }
      } else if (
        ext === "mp3" ||
        ext === "wav" ||
        ext === "m4a" ||
        ext === "ogg"
      ) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const ctx = new window.AudioContext();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const url = URL.createObjectURL(file);
          store.setAudioFile(file, audioBuffer, url);
        } catch (err) {
          console.error("Failed to parse audio", err);
          alert("Failed to parse audio file");
        }
      }
    }
  };

  return (
    <div
      className={`app-container ${theme}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ overflow: "hidden", position: "relative" }}
    >
      {isDragging && (
        <div className="le-drag-overlay">
          <FileDown size={48} color="#a5b4fc" opacity={0.8} />
          <div className="le-drag-text">Drop Audio or MIDI files here</div>
        </div>
      )}
      <div className="le-page">
        {/* Toolbar */}
        <div className="le-header-area">
          <LevelEditorToolbar />
        </div>

        <div className="le-main-area">
          <div
            style={{
              width: trackPanelWidth,
              flexShrink: 0,
              display: "flex",
              minHeight: 0,
            }}
          >
            <TrackPanel />
          </div>
          <div
            className="le-resizer le-resizer-horizontal"
            onMouseDown={(e) => startResize(e, "track")}
          />

          <div className="le-workspace">
            <div
              className="le-synced-views"
              style={{
                display: activeTab === "pianoroll" ? "flex" : "none",
                position: "relative",
              }}
            >
              <GlobalPlayhead />
              <div
                style={{
                  height: waveformHeight,
                  flexShrink: 0,
                  display: "flex",
                }}
              >
                <WaveformView />
              </div>
              <div
                className="le-resizer le-resizer-vertical"
                onMouseDown={(e) => startResize(e, "waveform")}
              />
              <div className="le-pr-canvas-area">
                <PianoRoll />
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                visibility:
                  activeTab === "blocks" || activeTab === "charting"
                    ? "visible"
                    : "hidden",
                pointerEvents:
                  activeTab === "blocks" || activeTab === "charting"
                    ? "auto"
                    : "none",
              }}
            >
              <div
                className="le-blocks-container"
                style={{ position: "relative", width: "100%", height: "100%" }}
              >
                <CanvasProvider type="editor">
                  <ShortcutsEnabler />
                  <BlocksPlaybackSync />
                  <SharedCanvas context="editor" />
                  {activeTab === "blocks" && (
                    <div className="le-blocks-hint">
                      Drag blocks to arrange your beatmap layout
                    </div>
                  )}

                  {/* Editor UI overlays for blocks mode */}
                  <div
                    className="ui-overlay"
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      zIndex: 10,
                    }}
                  >
                    {activeTab === "blocks" && (
                      <div
                        className="ui-pointer-events"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (e.nativeEvent)
                            e.nativeEvent.stopImmediatePropagation();
                        }}
                      >
                        <Toolbar />
                        <OutlinerPanel />
                        <PocketCanvasPanel />
                        <PocketDragOverlay />
                        <PianoKeyboard />
                        <DrumKeyboard />
                        <SettingsPanel />
                        <HelpPanel />
                        <SelectionPropertiesHud bottomOffset={100} />
                        <ContextMenu />
                      </div>
                    )}
                  </div>

                  {activeTab === "charting" && <ChartingTab />}

                  {activeTab === "blocks" && <CanvasPlayerBar />}
                </CanvasProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
