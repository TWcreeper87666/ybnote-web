import React, { useState, useRef, useEffect } from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { getTrackColor } from '../../utils/trackColors';
import { Plus, Copy, Trash2, Eye, EyeOff, Volume2, VolumeX, Blocks } from 'lucide-react';
import { EditorContextMenu, EditorContextMenuItem, EditorContextMenuDivider } from './EditorContextMenu';

const getInstrumentIcon = (instrument: string) => {
  switch (instrument) {
    case 'piano': return '🎹';
    case 'bass': return '🎸';
    case 'synth': return '📻';
    case 'percussion': return '🥁';
    case 'group_rect': return '🟩';
    default: return '🎹';
  }
};

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
      store.removeTrack(idToRemove);
    }
  };

  // Global events
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === 'F2' && store.selectedTrackId !== null) {
        e.preventDefault();
        const track = tracks.find(t => t.id === store.selectedTrackId);
        if (track) startRename(track.id, track.name);
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedTrackId !== null) {
        // If focus is inside TrackPanel or no notes are selected in PianoRoll
        if (target.closest('.le-track-panel') || store.selectedNoteIds.size === 0) {
          e.preventDefault();
          handleRemoveTrack(store.selectedTrackId);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeydown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.selectedTrackId, tracks, store.selectedNoteIds.size]);

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

  const handleInstrumentChange = (instrument: string) => {
    if (contextMenu && contextMenu.trackId !== null) {
      store.updateTrackInstrument(contextMenu.trackId, instrument);
    }
    setContextMenu(null);
  };

  return (
    <aside className="le-track-panel" style={{ minHeight: 0 }}>
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
              tabIndex={-1}
              className={`le-tp-item ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                store.selectTrack(track.id);
                e.currentTarget.focus();
              }}
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
                    <span className="le-tp-name">
                      <span style={{ marginRight: 6 }} title={track.instrument}>{getInstrumentIcon(track.instrument)}</span>
                      {track.name}
                    </span>
                    <span className="le-tp-notes">{track.notes.length} notes</span>
                  </>
                )}
              </div>

              <div className="le-tp-actions">
                {!isActive && (
                  <button
                    className={`le-tp-icon-btn ${isGhostVisible ? 'ghost-active' : ''}`}
                    title={isGhostVisible ? 'Hide Ghost Notes' : 'Show Ghost Notes'}
                    onClick={(e) => { e.stopPropagation(); store.toggleGhostNotes(track.id); }}
                  >
                    {isGhostVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                <button
                  className="le-tp-icon-btn"
                  style={{
                    color: track.isBackground ? 'rgba(255,255,255,0.4)' : '#a5b4fc',
                    borderRadius: 4
                  }}
                  title={track.isBackground ? 'Play as Background (Hidden in Blocks)' : 'Include in Game Blocks'}
                  onClick={(e) => { e.stopPropagation(); store.toggleTrackBackground(track.id); }}
                >
                  <Blocks size={14} />
                </button>
                <button
                  className={`le-tp-icon-btn ${isMuted ? 'muted' : ''}`}
                  title={isMuted ? 'Unmute Track' : 'Mute Track'}
                  onClick={(e) => { e.stopPropagation(); store.toggleTrackMute(track.id); }}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
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
        <EditorContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.trackId !== null ? (
            <>
              <EditorContextMenuItem onClick={() => handleContextAction('rename')}>Rename (F2)</EditorContextMenuItem>
              <EditorContextMenuItem onClick={() => handleContextAction('duplicate')}>Duplicate</EditorContextMenuItem>
              <EditorContextMenuDivider />
              <div style={{ padding: '4px 12px', fontSize: 11, opacity: 0.6, textTransform: 'uppercase', fontWeight: 'bold' }}>Instrument</div>
              <EditorContextMenuItem onClick={() => handleInstrumentChange('piano')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getInstrumentIcon('piano')} Piano</div>
              </EditorContextMenuItem>
              <EditorContextMenuItem onClick={() => handleInstrumentChange('bass')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getInstrumentIcon('bass')} Bass</div>
              </EditorContextMenuItem>
              <EditorContextMenuItem onClick={() => handleInstrumentChange('synth')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getInstrumentIcon('synth')} Synth</div>
              </EditorContextMenuItem>
              <EditorContextMenuItem onClick={() => handleInstrumentChange('percussion')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getInstrumentIcon('percussion')} Drums</div>
              </EditorContextMenuItem>
              <EditorContextMenuItem onClick={() => handleInstrumentChange('group_rect')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getInstrumentIcon('group_rect')} Group Rect</div>
              </EditorContextMenuItem>
              <EditorContextMenuDivider />
              <EditorContextMenuItem danger onClick={() => handleContextAction('remove')}>Remove</EditorContextMenuItem>
            </>
          ) : (
            <EditorContextMenuItem onClick={() => handleContextAction('add')}>Add Track</EditorContextMenuItem>
          )}
        </EditorContextMenu>
      )}
    </aside>
  );
};
