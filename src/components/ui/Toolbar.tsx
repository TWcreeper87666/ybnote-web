import React from "react";
import { useStore, undoAction, redoAction } from "../../store/useStore";
import { useUIStore } from "../../store/useUIStore";
import { useGameStore } from "../../store/useGameStore";
import { useLevelEditorStore } from "../../store/useLevelEditorStore";
import {
  Settings,
  Music,
  Drum,
  Trash2,
  Undo2,
  Redo2,
  LayoutList,
  LayoutGrid,
  PenTool,
  HelpCircle,
  Square,
  Wand2,
  Circle,
  Upload,
} from "lucide-react";
import { exportRecordedEventsToMidi } from "../../utils/midiUtils";
import { ToolbarButton } from "./ToolbarButton";
import { useCanvasContext } from "../canvas/CanvasContext";
import { ToolbarDivider } from "./ToolbarDivider";

const NOTES = [
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
] as const;
const noteNameToMidi = (name: string): number => {
  const match = name.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60;
  const noteIndex = NOTES.indexOf(match[1] as (typeof NOTES)[number]);
  const octave = parseInt(match[2], 10);
  return (octave + 1) * 12 + (noteIndex < 0 ? 0 : noteIndex);
};

export const Toolbar: React.FC = () => {
  // 將畫布與核心邏輯保留在 useStore
  const {
    deleteSelected,
    selectedBlockIds,
    selectedTrackIds,
    selectedGroupRectIds,
    mode,
    setMode,
    isRecording,
    startRecording,
    stopRecording,
  } = useStore();

  // 將 UI 面板的開關邏輯改由 useUIStore 提取
  const {
    toggleSettings,
    toggleHelp,
    toggleOutliner,
    togglePocketCanvas,
    isOutlinerOpen,
    isPocketCanvasOpen,
  } = useUIStore();

  const editorSelectedBlockIds = useLevelEditorStore((s) => s.selectedBlockIds);
  const editorSelectedTrackIds = useLevelEditorStore((s) => s.selectedTrackIds);
  const editorSelectedGroupRectIds = useLevelEditorStore(
    (s) => s.selectedGroupRectIds,
  );
  const editorActiveTab = useLevelEditorStore((s) => s.activeTab);
  const canvasContext = useCanvasContext();

  const handleStopRecording = () => {
    stopRecording();
    if (canvasContext !== "editor" || editorActiveTab !== "blocks") return;

    const events = useStore.getState().recordedEvents;
    if (events.length === 0) return;

    const editorBlocks = useLevelEditorStore.getState().blocks;
    const byInstrument: Record<string, { pitch: string; time: number }[]> = {};

    for (const event of events) {
      if (event.type !== "block") continue;
      const block = editorBlocks.find((b) => b.id === event.targetId);
      if (!block) continue;
      const instr = block.instrument || "piano";
      if (!byInstrument[instr]) byInstrument[instr] = [];
      byInstrument[instr].push({ pitch: block.pitch, time: event.time });
    }

    if (Object.keys(byInstrument).length === 0) return;

    const now = Date.now();
    const maxTime = Math.max(...events.map((e) => e.time)) / 1000 + 1;
    const newTracks = Object.entries(byInstrument).map(
      ([instrument, items], i) => ({
        id: now + i,
        name: `Recorded ${instrument}`,
        instrument: instrument as "piano" | "bass" | "synth" | "percussion",
        notes: items.map((item, ni) => ({
          id: `rec-${now}-${i}-${ni}`,
          pitch: noteNameToMidi(item.pitch),
          name: item.pitch,
          timeStart: item.time / 1000,
          duration: 0.25,
          velocity: 1,
        })),
      }),
    );

    const es = useLevelEditorStore.getState();
    es.appendMidiData({
      bpm: es.bpm || 120,
      duration: maxTime,
      tracks: newTracks,
    });
  };

  const effectiveSelectedBlockIds =
    canvasContext === "editor" ? editorSelectedBlockIds : selectedBlockIds;
  const effectiveSelectedTrackIds =
    canvasContext === "editor" ? editorSelectedTrackIds : selectedTrackIds;
  const effectiveSelectedGroupRectIds =
    canvasContext === "editor"
      ? editorSelectedGroupRectIds
      : selectedGroupRectIds;
  const effectiveDeleteSelected =
    canvasContext === "editor"
      ? () => useLevelEditorStore.getState().deleteSelected()
      : deleteSelected;

  return (
    <>
      {useGameStore.getState().gamePhase !== "arrange" && (
        <div className="top-toolbar glass-panel" style={{ gap: "8px" }}>
          <ToolbarButton
            active={mode === "piano"}
            onClick={() => {
              setMode(mode === "piano" ? "select" : "piano");
            }}
            title="Add Note (1)"
            icon={<Music size={24} />}
          />

          <ToolbarButton
            active={mode === "drum"}
            onClick={() => {
              setMode(mode === "drum" ? "select" : "drum");
            }}
            title="Add Drum Block (2)"
            icon={<Drum size={24} />}
          />

          <ToolbarButton
            active={mode === "draw_group"}
            onClick={() =>
              setMode(mode === "draw_group" ? "select" : "draw_group")
            }
            title="Draw Group (3)"
            icon={<Square size={24} fill="currentColor" />}
          />

          <ToolbarButton
            active={mode === "draw_track"}
            onClick={() =>
              setMode(mode === "draw_track" ? "select" : "draw_track")
            }
            title="Draw Track (4)"
            icon={<PenTool size={24} />}
          />

          <ToolbarButton
            active={mode === "play"}
            onClick={() => setMode(mode === "play" ? "select" : "play")}
            title="Perform Mode (5)"
            icon={<Wand2 size={24} />}
          />

          <ToolbarDivider variant="playground" />

          <ToolbarButton
            className={isRecording ? "danger-btn" : ""}
            onClick={() =>
              isRecording ? handleStopRecording() : startRecording()
            }
            title={isRecording ? "Stop Recording" : "Record Macro"}
            icon={
              <Circle size={24} fill={isRecording ? "currentColor" : "none"} />
            }
          />

          <ToolbarButton
            onClick={exportRecordedEventsToMidi}
            title="Export Recording to MIDI"
            icon={<Upload size={24} />}
          />
        </div>
      )}

      <div className="toolbar glass-panel">
        {canvasContext !== "editor" && (
          <>
            <ToolbarButton
              onClick={undoAction}
              title="Undo"
              icon={<Undo2 size={24} />}
            />
            <ToolbarButton
              onClick={redoAction}
              title="Redo"
              icon={<Redo2 size={24} />}
            />
          </>
        )}

        <ToolbarButton
          className={
            effectiveSelectedBlockIds.length > 0 ||
            effectiveSelectedTrackIds.length > 0 ||
            effectiveSelectedGroupRectIds.length > 0
              ? "danger-btn"
              : "disabled-btn"
          }
          onClick={effectiveDeleteSelected}
          disabled={
            effectiveSelectedBlockIds.length === 0 &&
            effectiveSelectedTrackIds.length === 0 &&
            effectiveSelectedGroupRectIds.length === 0
          }
          title="Delete Selected"
          icon={<Trash2 size={24} />}
        />

        <ToolbarDivider variant="editor" orientation="horizontal" />

        <ToolbarButton
          onClick={toggleOutliner}
          title="Toggle Outliner"
          icon={<LayoutList size={24} />}
          active={isOutlinerOpen}
          variant="panel-toggle"
        />

        <ToolbarButton
          onClick={togglePocketCanvas}
          title="Toggle Pocket Canvas"
          icon={<LayoutGrid size={24} />}
          active={isPocketCanvasOpen}
          variant="panel-toggle"
        />

        <ToolbarDivider variant="editor" orientation="horizontal" />

        <ToolbarButton
          onClick={toggleSettings}
          title="Settings"
          icon={<Settings size={24} />}
        />

        <ToolbarButton
          onClick={toggleHelp}
          title="Help & Shortcuts"
          icon={<HelpCircle size={24} />}
        />
      </div>
    </>
  );
};
