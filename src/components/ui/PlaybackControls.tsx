import React from 'react';
import { useStore } from '../../store/useStore';
import { Play, Square, Pause } from 'lucide-react';

export const PlaybackControls: React.FC = () => {
  const { isPlaying, togglePlay, stopPlay } = useStore();

  return (
    <div className="playback-controls glass-panel" style={{ padding: '12px', borderRadius: '20px', gap: '8px' }}>
      <button 
        className={`toolbar-btn ${isPlaying ? 'primary-btn' : ''}`}
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
      </button>
      <button 
        className="toolbar-btn"
        onClick={stopPlay}
        title="Stop"
      >
        <Square size={20} />
      </button>
    </div>
  );
};
