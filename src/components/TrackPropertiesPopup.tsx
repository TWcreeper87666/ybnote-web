import React from 'react';
import { useStore } from '../store/useStore';
import { X } from 'lucide-react';

export const TrackPropertiesPopup: React.FC = () => {
  const { editingTrackId, tracks, setEditingTrackId, updateTrack, deleteTrack } = useStore();

  const track = tracks.find(t => t.id === editingTrackId);

  if (!editingTrackId || !track) {
    return null;
  }

  return (
    <div className="settings-panel glass-panel" style={{ right: '50%', top: '50%', transform: 'translate(50%, -50%)' }}>
      <div className="settings-header">
        <h2>Track Properties</h2>
        <button className="icon-btn icon-btn-round" onClick={() => setEditingTrackId(null)}>
          <X size={20} />
        </button>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <h3>Playback</h3>
          
          <div className="settings-row" style={{ marginBottom: 16 }}>
            <span className="settings-label">Speed (BPM)</span>
            <input 
              type="number" 
              value={track.bpm} 
              onChange={(e) => updateTrack(track.id, { bpm: Number(e.target.value) || 120 })}
              style={{ width: 80, padding: 6, borderRadius: 8, border: '1px solid #ccc', background: 'var(--action-bg)', color: 'var(--settings-text)' }}
            />
          </div>

          <div 
            className="switch-row" 
            onClick={() => updateTrack(track.id, { loop: !track.loop })}
          >
            <span>Loop Track</span>
            <div className={`switch-track ${track.loop ? 'active' : ''}`}>
              <div className="switch-thumb" />
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button 
            className="action-btn" 
            style={{ color: '#ef4444' }}
            onClick={() => {
              deleteTrack(track.id);
              setEditingTrackId(null);
            }}
          >
            Delete Track
          </button>
        </div>
      </div>
    </div>
  );
};
