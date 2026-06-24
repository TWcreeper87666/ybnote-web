import React from "react";
import { BaseBlock } from "./BaseBlock";
import { DrumBlock } from "./DrumBlock";
import { useLevelEditorStore } from "../../store/useLevelEditorStore";
import { useCanvasStore } from "../../store/useCanvasStore";
import { getPitchColorNumber } from "../../utils/colors";
import { useBlockDrag } from "../../hooks/useBlockDrag";
import { useSettingsStore } from "../../store";

interface NoteBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
}

export const NoteBlock: React.FC<NoteBlockProps> = ({ id, x, y, pitch }) => {
  const {
    blockOpacity,
    showBlockPitch,
    showBlockVolume,
    showBlockInstrument,
    pianoKeysCount,
  } = useSettingsStore();

  // 從 CanvasStore（由 CanvasStoreProvider 注入）取得
  const store = useCanvasStore((s) => s);
  const { blocks, selectedBlockIds, mode } = store;

  // 1. Move these hook calls to the top level of the component
  const setHoveredBlockId = useCanvasStore((s) => s.setHoveredBlockId);
  const hoveredBlockId = useCanvasStore((s) => s.hoveredBlockId);

  const isSelected = selectedBlockIds.includes(id);
  const block = blocks.find((b) => b.id === id);
  const volume = block?.volume ?? 1;
  const instrument = block?.instrument ?? "piano";
  const playedAt = block?.playedAt;

  const { handlePointerDown, handlePointerUp } = useBlockDrag(
    id,
    x,
    y,
    isSelected,
  );

  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);

  const playedVolumeMultiplier = block?.playedVolumeMultiplier ?? 1;
  const lastPlayedRef = React.useRef(playedAt || 0);

  // Editor-specific state
  const isRecordingChart = useLevelEditorStore((s) => s.isRecordingChart);
  const chartingHighlightIds = useLevelEditorStore(
    (s) => s.chartingHighlightIds,
  );
  const isChartingHighlight = chartingHighlightIds.includes(id);
  const midiData = useLevelEditorStore((s) => s.midiData);

  React.useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      const isInitial =
        Date.now() - playedAt > 2000 && lastPlayedRef.current === 0;
      lastPlayedRef.current = playedAt;

      if (isInitial) return;

      if (isRecordingChart) {
        useLevelEditorStore.getState().recordChartHit(id, "block");
      }

      import("../../utils/audio").then(({ playNote }) => {
        playNote(pitch, volume * playedVolumeMultiplier, instrument);
        if (mode === "play") {
          store.setLatestPerformHit({ time: Date.now(), color: blockColor });
        }
      });
    }
  }, [
    playedAt,
    pitch,
    volume,
    instrument,
    playedVolumeMultiplier,
    blockColor,
    isRecordingChart,
    id,
  ]);

  // 2. Use the values extracted from the top-level hooks here
  const handlePointerEnter = () => {
    setHoveredBlockId?.(id);
  };

  const handlePointerLeave = () => {
    if (hoveredBlockId === id) {
      setHoveredBlockId?.(null);
    }
  };

  const BlockComponent = instrument === "percussion" ? DrumBlock : BaseBlock;

  const isInvalid = React.useMemo(() => {
    if (!midiData) return false;
    for (const track of midiData.tracks) {
      if (track.instrument === instrument) {
        if (track.notes.some((n) => n.name === pitch)) return false;
      }
    }
    return true;
  }, [pitch, instrument, midiData]);

  return (
    <BlockComponent
      id={id}
      x={x}
      y={y}
      pitch={pitch}
      instrument={instrument}
      volume={volume}
      blockColor={blockColor}
      opacity={blockOpacity}
      isSelected={isSelected}
      showPitch={showBlockPitch}
      showInstrument={showBlockInstrument}
      showVolume={showBlockVolume}
      playedAt={playedAt}
      isInteractive={true}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      isInvalid={isInvalid}
      isHighlighted={isChartingHighlight}
    />
  );
};
