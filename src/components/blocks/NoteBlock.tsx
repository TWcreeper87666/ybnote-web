import React from 'react';
import { useStore } from '../../store/useStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { BaseBlock } from './BaseBlock';
import { DrumBlock } from './DrumBlock';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { getPitchColorNumber } from '../../utils/colors';
import { shiftPitch } from '../../utils/pitchUtils';
import { useCanvasContext } from '../canvas/CanvasContext';
import type { CanvasContextType } from '../canvas/CanvasContext';
import { useBlockDrag } from '../../hooks/useBlockDrag';
import { useBlockDragHandlers } from '../../hooks/useBlockDragHandlers';
import { useActiveCanvasSelectedBlockIds, setHoveredBlockIdInContext, openContextMenuInContext } from '../../hooks/useActiveCanvas';

interface NoteBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
  volume?: number;
  instrument?: string;
  playedAt?: number;
  playedVolumeMultiplier?: number;
  playedPitchOffset?: number;
  canvasContext?: CanvasContextType;
}

export const NoteBlock: React.FC<NoteBlockProps> = ({
  id, x, y, pitch,
  volume = 1,
  instrument = 'piano',
  playedAt,
  playedVolumeMultiplier = 1,
  playedPitchOffset = 0,
  canvasContext: canvasContextProp,
}) => {
  const selectedBlockIds = useActiveCanvasSelectedBlockIds();
  const isSelected = selectedBlockIds.includes(id);
  const { blockOpacity, showBlockPitch, showBlockVolume, showBlockInstrument, pianoKeysCount } = useSettingsStore();

  const { onDragStart } = useBlockDragHandlers(id, canvasContextProp);
  const { handlePointerDown, handlePointerUp } = useBlockDrag(id, x, y, isSelected, {
    canvasContext: canvasContextProp,
    onDragStart,
    onContextMenu: (pos) => openContextMenuInContext(canvasContext, { ...pos, blockId: id }),
  });

  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);
  const lastPlayedRef = React.useRef(playedAt || 0);

  const canvasContextFromHook = useCanvasContext();
  const canvasContext = canvasContextProp ?? canvasContextFromHook;
  const isEditor = canvasContext === 'editor';
  const isRecordingChart = useLevelEditorStore((s) => isEditor ? s.isRecordingChart : false);
  const chartingHighlightIds = useLevelEditorStore((s) => s.chartingHighlightIds);
  const chartingHighlightWeights = useLevelEditorStore((s) => s.chartingHighlightWeights);
  const isChartingHighlight = chartingHighlightIds.includes(id);
  const highlightIntensity = isChartingHighlight ? (chartingHighlightWeights[id] ?? 1) : 1;
  const midiData = useLevelEditorStore((s) => isEditor ? s.midiData : null);


  React.useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      const isInitial = Date.now() - playedAt > 2000 && lastPlayedRef.current === 0;
      lastPlayedRef.current = playedAt;

      if (isInitial) return;

      if (isEditor && isRecordingChart) {
        useLevelEditorStore.getState().recordChartHit(id, 'block');
      }
      
      const isEditorPlaying = isEditor && useLevelEditorStore.getState().isPlaying;

      if (!isEditorPlaying) {
          import('../../utils/audio').then(({ playNote }) => {
              const effectivePitch = playedPitchOffset !== 0 ? shiftPitch(pitch, playedPitchOffset) : pitch;
              playNote(effectivePitch, volume * playedVolumeMultiplier, instrument);
              if (useStore.getState().mode === 'play') {
                 useStore.getState().setLatestPerformHit({ time: Date.now(), color: blockColor });
              }
          });
      }
    }
  }, [playedAt, pitch, volume, instrument, playedVolumeMultiplier, playedPitchOffset, blockColor, isEditor, isRecordingChart, id]);



  const handlePointerEnter = () => setHoveredBlockIdInContext(canvasContext, id);
  const handlePointerLeave = () => setHoveredBlockIdInContext(canvasContext, null);

  const BlockComponent = instrument === 'percussion' ? DrumBlock : BaseBlock;

  const isInvalid = React.useMemo(() => {
    if (!isEditor || !midiData) return false;
    for (const track of midiData.tracks) {
      if (track.instrument === instrument) {
        if (track.notes.some(n => n.name === pitch)) return false;
      }
    }
    return true;
  }, [pitch, instrument, midiData, isEditor]);

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
      highlightIntensity={highlightIntensity}
    />
  );
};
