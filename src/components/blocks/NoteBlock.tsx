import React from 'react';
import { useStore } from '../../store/useStore';
import { BaseBlock } from './BaseBlock';
import { DrumBlock } from './DrumBlock';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { getPitchColorNumber } from '../../utils/colors';
import { isLevelEditor } from '../../utils/routeUtils';
import { useBlockDrag } from '../../hooks/useBlockDrag';

interface NoteBlockProps {
  id: string;
  x: number;
  y: number;
  pitch: string;
}

export const NoteBlock: React.FC<NoteBlockProps> = ({ id, x, y, pitch }) => {
  const { selectedBlockIds } = useStore();
  const blockOpacity = useStore(state => state.blockOpacity);
  const isSelected = selectedBlockIds.includes(id);
  const block = useStore(state => state.blocks.find(b => b.id === id) || state.gameBlocks.find(b => b.id === id));
  const volume = block?.volume ?? 1;
  const instrument = block?.instrument ?? 'piano';
  const playedAt = block?.playedAt;

  const showBlockPitch = useStore(state => state.showBlockPitch);
  const showBlockVolume = useStore(state => state.showBlockVolume);
  const showBlockInstrument = useStore(state => state.showBlockInstrument);

  const { handlePointerDown, handlePointerUp } = useBlockDrag(id, x, y, isSelected);

  const pianoKeysCount = useStore(state => state.pianoKeysCount);
  const blockColor = getPitchColorNumber(pitch, pianoKeysCount);

  const playedVolumeMultiplier = block?.playedVolumeMultiplier ?? 1;
  const lastPlayedRef = React.useRef(playedAt || 0);

  const isEditor = isLevelEditor();
  const isRecordingChart = useLevelEditorStore((s) => isEditor ? s.isRecordingChart : false);
  const chartingHighlightIds = useLevelEditorStore((s) => s.chartingHighlightIds);
  const isChartingHighlight = chartingHighlightIds.includes(id);
  const midiData = useLevelEditorStore((s) => isEditor ? s.midiData : null);

  React.useEffect(() => {
    if (playedAt && playedAt !== lastPlayedRef.current) {
      const isInitial = Date.now() - playedAt > 2000 && lastPlayedRef.current === 0;
      lastPlayedRef.current = playedAt;

      if (isInitial) return;

      if (isEditor && isRecordingChart) {
        useLevelEditorStore.getState().recordChartHit(id, 'block');
      }
      
      const isLevelEditorPlaying = isLevelEditor() && 
        (() => {
           try {
             const state = (window as { levelEditorStore?: { getState: () => { isPlaying: boolean } } }).levelEditorStore?.getState();
             return state?.isPlaying ?? false;
           } catch {
             return false;
           }
        })();

      if (!isLevelEditorPlaying) {
          import('../../utils/audio').then(({ playNote }) => {
              playNote(pitch, volume * playedVolumeMultiplier, instrument);
              if (useStore.getState().mode === 'play') {
                 useStore.getState().setLatestPerformHit({ time: Date.now(), color: blockColor });
              }
          });
      }
    }
  }, [playedAt, pitch, volume, instrument, playedVolumeMultiplier, blockColor, isEditor, isRecordingChart, id]);



  const handlePointerEnter = () => useStore.getState().setHoveredBlockId(id);
  const handlePointerLeave = () => {
    const state = useStore.getState();
    if (state.hoveredBlockId === id) {
      state.setHoveredBlockId(null);
    }
  };

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
    />
  );
};
