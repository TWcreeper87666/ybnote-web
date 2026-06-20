import React, { useState, useRef, useEffect } from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { getTrackColor } from '../../utils/trackColors';
import { Plus, Copy, Trash2, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';

export const TrackPanel: React.FC = () => {
  const store = useLevelEditorStore();
  const tracks = store.midiData?.tracks || [];

  const [renamingTrackId, setRenamingTrackId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackId: number | null } | null>(null);

  // Rename focus
  useEffect(() => {
    if (renamingTrackId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTrackId]);

  const startRename = (trackId: number, currentName: string) => {
    setRenamingTrackId(trackId);
    setRenameInput(currentName);
  };

  const finishRename = () => {
    if (renamingTrackId !== null && renameInput.trim()) {
      store.renameTrack(renamingTrackId, renameInput.trim());
    }
    setRenamingTrackId(null);
  };

  const cancelRename = () => {
    setRenamingTrackId(null);
  };

  const handleAddTrack = () => {
    store.addTrack();
  };

  const handleDuplicateTrack = () => {
    if (store.selectedTrackId !== null) {
      store.duplicateTrack(store.selectedTrackId);
    }
  };

  const handleRemoveTrack = (trackId: number | null = null) => {
    const idToRemove = trackId ?? store.selectedTrackId;
    if (idToRemove !== null && tracks.length > 0) {
      if (window.confirm('Are you sure you want to delete this track?')) {
        store.removeTrack(idToRemove);
      }
    }
  };

  // Global events
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && store.selectedTrackId !== null) {
        e.preventDefault();
        const track = tracks.find(t => t.id === store.selectedTrackId);
        if (track) startRename(track.id, track.name);
      }
    };

    const handleGlobalClick = () => {
      setContextMenu(null);
    };

    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [store.selectedTrackId, tracks]);

  const openContextMenu = (e: React.MouseEvent, trackId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, trackId });
  };

  const handleContextAction = (action: 'rename' | 'duplicate' | 'remove' | 'add') => {
    setContextMenu(null);
    if (action === 'add') {
      handleAddTrack();
    } else if (contextMenu && contextMenu.trackId !== null) {
      const targetId = contextMenu.trackId;
      if (action === 'rename') {
        const track = tracks.find(t => t.id === targetId);
        if (track) startRename(track.id, track.name);
      } else if (action === 'duplicate') {
        store.duplicateTrack(targetId);
      } else if (action === 'remove') {
        handleRemoveTrack(targetId);
      }
    }
  };

  return (
    <aside className="le-track-panel">
      <div className="le-tp-header">
        <span className="le-tp-title">Tracks</span>
        <span className="le-tp-count">{tracks.length}</span>
      </div>

      <div className="le-tp-list" onContextMenu={(e) => openContextMenu(e, null)}>
        {tracks.map(track => {
          const isActive = store.selectedTrackId === track.id;
          const isMuted = !!store.trackMute[track.id];
          const isGhostVisible = !!store.ghostNoteVisibility[track.id];

          return (
            <div
              key={track.id}
              className={`le-tp-item ${isActive ? 'active' : ''}`}
              onClick={() => store.selectTrack(track.id)}
              onDoubleClick={() => startRename(track.id, track.name)}
              onContextMenu={(e) => openContextMenu(e, track.id)}
            >
              <div className="le-tp-color" style={{ backgroundColor: getTrackColor(track.id) }} />
              
              <div className="le-tp-info">
                {renamingTrackId === track.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameInput}
                    onChange={e => setRenameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') finishRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onBlur={finishRename}
                    onClick={e => e.stopPropagation()}
                    className="le-tp-rename"
                  />
                ) : (
                  <>
                    <span className="le-tp-name">{track.name}</span>
                    <span className="le-tp-notes">{track.notes.length} notes</span>
                  </>
                )}
              </div>

              <div className="le-tp-actions">
                <button
                  className={`le-tp-icon-btn ${isMuted ? 'muted' : ''}`}
                  title={isMuted ? 'Unmute Track' : 'Mute Track'}
                  onClick={(e) => { e.stopPropagation(); store.toggleTrackMute(track.id); }}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                {!isActive && (
                  <button
                    className={`le-tp-icon-btn ${isGhostVisible ? 'ghost-active' : ''}`}
                    title={isGhostVisible ? 'Hide Ghost Notes' : 'Show Ghost Notes'}
                    onClick={(e) => { e.stopPropagation(); store.toggleGhostNotes(track.id); }}
                  >
                    {isGhostVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="le-tp-footer">
        <button className="le-tp-action-btn" onClick={handleAddTrack} title="Add Track">
          <Plus size={16} />
        </button>
        <button className="le-tp-action-btn" onClick={handleDuplicateTrack} disabled={store.selectedTrackId === null} title="Duplicate Track">
          <Copy size={14} />
        </button>
        <button className="le-tp-action-btn remove" onClick={() => handleRemoveTrack(null)} disabled={store.selectedTrackId === null || tracks.length === 0} title="Remove Track">
          <Trash2 size={14} />
        </button>
      </div>

      {contextMenu && (
        <div 
          className="le-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.trackId !== null ? (
            <>
              <button className="le-cm-item" onClick={() => handleContextAction('rename')}>Rename (F2)</button>
              <button className="le-cm-item" onClick={() => handleContextAction('duplicate')}>Duplicate</button>
              <div className="le-cm-divider" />
              <button className="le-cm-item danger" onClick={() => handleContextAction('remove')}>Remove</button>
            </>
          ) : (
            <button className="le-cm-item" onClick={() => handleContextAction('add')}>Add Track</button>
          )}
        </div>
      )}
    </aside>
  );
};
