import React from 'react';
import { usePlaygroundStore } from '../../store/usePlaygroundStore';
import { Play, Square, Pause } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const PlaybackControls: React.FC = () => {
  const isPlaying = usePlaygroundStore((s) => s.isPlaying);
  const togglePlay = usePlaygroundStore((s) => s.togglePlay);
  const stopPlay = usePlaygroundStore((s) => s.stopPlay);

  return (
    <div className="playback-controls glass-panel" style={{ padding: '12px', borderRadius: '20px', gap: '8px' }}>
      <ToolbarButton
        active={isPlaying}
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play"}
        icon={isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
      />
      <ToolbarButton
        onClick={stopPlay}
        title="Stop"
        icon={<Square size={20} />}
      />
    </div>
  );
};
