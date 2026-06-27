import React from 'react';
import { useStore } from '../../../store/useStore';
import { useLevelEditorStore } from '../../../store/useLevelEditorStore';
import { NoteBlock } from '../../blocks/NoteBlock';

interface BlockLayerProps {
  context: 'playground' | 'editor';
}

export const BlockLayer: React.FC<BlockLayerProps> = ({ context }) => {
  const playgroundBlocks = useStore(s => s.blocks);
  const editorBlocks = useLevelEditorStore(s => s.blocks);
  const blocks = context === 'editor' ? editorBlocks : playgroundBlocks;

  return (
    <>
      {blocks.map(block => (
        <NoteBlock
          key={block.id}
          id={block.id}
          x={block.x}
          y={block.y}
          pitch={block.pitch}
          volume={block.volume}
          instrument={block.instrument}
          playedAt={block.playedAt}
          playedVolumeMultiplier={block.playedVolumeMultiplier}
          canvasContext={context}
        />
      ))}
    </>
  );
};
