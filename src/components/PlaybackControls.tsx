import React from 'react';
import { useStore } from '../store/useStore';
import { Play, Square, Pause } from 'lucide-react';

export const PlaybackControls: React.FC = () => {
  const { isPlaying, togglePlay, stopPlay } = useStore();

  return (
    <div className="playback-controls glass-panel">
      <button 
        className={`playback-btn ${isPlaying ? 'active' : ''}`}
        onClick={togglePlay}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
      </button>
      <button 
        className="playback-btn"
        onClick={stopPlay}
        title="Stop"
      >
        <Square size={20} />
      </button>
    </div>
  );
};
