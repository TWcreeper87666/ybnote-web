import React from 'react';
import { useStore } from '../../store/useStore';

export const SelectionPropertiesHud: React.FC = () => {
  const {
    blocks,
    tracks,
    groupRects,
    selectedBlockIds,
    selectedTrackIds,
    selectedGroupRectIds,
    mode
  } = useStore();

  const totalSelected = selectedBlockIds.length + selectedTrackIds.length + selectedGroupRectIds.length;

  if (totalSelected === 0 || mode === 'play') {
    return null;
  }

  return (
    <div className="selection-properties-hud">
      <div className="hud-header">Selected Properties</div>
      {totalSelected === 1 ? (
        <div className="hud-content">
          {selectedBlockIds.length === 1 && (() => {
            const block = blocks.find(b => b.id === selectedBlockIds[0]);
            if (!block) return null;
            return (
              <>
                <div className="hud-row"><span className="hud-label">Type:</span> <span className="hud-value">Note Block</span></div>
                <div className="hud-row"><span className="hud-label">Pitch:</span> <span className="hud-value">{block.pitch}</span></div>
                <div className="hud-row"><span className="hud-label">Instrument:</span> <span className="hud-value">{block.instrument}</span></div>
                <div className="hud-row"><span className="hud-label">Volume:</span> <span className="hud-value">{Math.round((block.volume ?? 1) * 100)}%</span></div>
                {block.keyBinding && <div className="hud-row"><span className="hud-label">Key Binding:</span> <span className="hud-value">{block.keyBinding}</span></div>}
              </>
            );
          })()}

          {selectedTrackIds.length === 1 && (() => {
            const track = tracks.find(t => t.id === selectedTrackIds[0]);
            if (!track) return null;
            return (
              <>
                <div className="hud-row"><span className="hud-label">Type:</span> <span className="hud-value">Track</span></div>
                <div className="hud-row"><span className="hud-label">Name:</span> <span className="hud-value">{track.name || 'Unnamed Track'}</span></div>
                <div className="hud-row"><span className="hud-label">BPM:</span> <span className="hud-value">{track.bpm}</span></div>
                <div className="hud-row"><span className="hud-label">Loop:</span> <span className="hud-value">{track.loop === true ? 'Yes' : track.loop === 'restart' ? 'Restart' : 'No'}</span></div>
                <div className="hud-row"><span className="hud-label">Enabled:</span> <span className="hud-value">{track.enabled !== false ? 'Yes' : 'No'}</span></div>
                <div className="hud-row"><span className="hud-label">Nodes:</span> <span className="hud-value">{track.nodes.length}</span></div>
              </>
            );
          })()}

          {selectedGroupRectIds.length === 1 && (() => {
            const groupRect = groupRects.find(g => g.id === selectedGroupRectIds[0]);
            if (!groupRect) return null;
            return (
              <>
                <div className="hud-row"><span className="hud-label">Type:</span> <span className="hud-value">Group Region</span></div>
                <div className="hud-row"><span className="hud-label">Name:</span> <span className="hud-value">{groupRect.name || 'Unnamed Region'}</span></div>
                <div className="hud-row"><span className="hud-label">Notes:</span> <span className="hud-value">{blocks.filter(b => b.x + 30 >= groupRect.x && b.x + 30 <= groupRect.x + groupRect.w && b.y + 30 >= groupRect.y && b.y + 30 <= groupRect.y + groupRect.h).length}</span></div>
                <div className="hud-row"><span className="hud-label">Volume:</span> <span className="hud-value">{Math.round((groupRect.volume ?? 1) * 100)}%</span></div>
                <div className="hud-row"><span className="hud-label">Enabled:</span> <span className="hud-value">{groupRect.enabled !== false ? 'Yes' : 'No'}</span></div>
                {groupRect.keyBinding && <div className="hud-row"><span className="hud-label">Key Binding:</span> <span className="hud-value">{groupRect.keyBinding}</span></div>}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="hud-content">
          <div className="hud-row"><span className="hud-label">Multiple Items Selected:</span></div>
          {selectedBlockIds.length > 0 && <div className="hud-row"><span className="hud-label">Blocks:</span> <span className="hud-value">{selectedBlockIds.length}</span></div>}
          {selectedTrackIds.length > 0 && <div className="hud-row"><span className="hud-label">Tracks:</span> <span className="hud-value">{selectedTrackIds.length}</span></div>}
          {selectedGroupRectIds.length > 0 && <div className="hud-row"><span className="hud-label">Regions:</span> <span className="hud-value">{selectedGroupRectIds.length}</span></div>}
        </div>
      )}
    </div>
  );
};
