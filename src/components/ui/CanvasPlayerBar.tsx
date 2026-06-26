import React from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { Play, Pause, Volume2 } from 'lucide-react';

const PlayerSlider: React.FC = () => {
  const store = useLevelEditorStore();
  const wasPlayingRef = React.useRef(false);
  const [localVal, setLocalVal] = React.useState<number | null>(null);

  const handlePointerDown = () => {
    wasPlayingRef.current = useLevelEditorStore.getState().isPlaying;
    if (wasPlayingRef.current) store.stopPlayback();
    setLocalVal(store.playbackPosition);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalVal(val);
    store.setPlaybackAnchor(val);
  };

  const handlePointerUp = () => {
    setLocalVal(null);
    if (wasPlayingRef.current && !useLevelEditorStore.getState().isPlaying) {
      store.togglePlayback();
    }
  };

  return (
    <input
      type="range"
      min="0"
      max={store.chartEndPosition || 100}
      step="0.1"
      value={localVal !== null ? localVal : store.playbackPosition}
      onChange={handleChange}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onFocus={(e) => e.target.blur()}
      onKeyDown={(e) => e.preventDefault()}
      tabIndex={-1}
      style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer', pointerEvents: 'auto' }}
    />
  );
};

export const CanvasPlayerBar: React.FC = () => {
  const store = useLevelEditorStore();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: 'white', fontSize: 14, opacity: 0.8 }}>Preview Playback</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => store.togglePlayback()}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', pointerEvents: 'auto' }}
        >
          {store.isPlaying ? <Pause size={28} /> : <Play size={28} />}
        </button>

        <PlayerSlider />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          <Volume2 size={20} color="white" />
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={store.audioVolume}
            onChange={(e) => store.setAudioVolume(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: '#6366f1', cursor: 'pointer' }}
            tabIndex={-1}
            onFocus={(e) => e.target.blur()}
            onKeyDown={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
};
