import React from 'react';
import { useStore } from '../store/useStore';
import { Settings, Music, Drum, Trash2, Undo2, Redo2, LayoutList, PenTool, HelpCircle, Square, Play } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { toggleSettings, toggleHelp, toggleHierarchy, deleteSelected, selectedBlockIds, selectedTrackIds, selectedGroupRectIds, mode, setMode } = useStore();
  const { undo, redo } = useStore.temporal.getState();


  return (
    <>
      <div className="top-toolbar glass-panel" style={{ gap: '8px' }}>
        <button 
          className={`toolbar-btn ${mode === 'piano' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'piano' ? 'select' : 'piano')}
          title="Add Note (1)"
        >
          <Music size={24} />
        </button>

        <button 
          className={`toolbar-btn ${mode === 'drum' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'drum' ? 'select' : 'drum')}
          title="Add Drum Block (2)"
        >
          <Drum size={24} />
        </button>

        <button 
          className={`toolbar-btn ${mode === 'draw_group' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'draw_group' ? 'select' : 'draw_group')}
          title="Draw Group (3)"
        >
          <Square size={24} />
        </button>

        <button 
          className={`toolbar-btn ${mode === 'draw_track' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'draw_track' ? 'select' : 'draw_track')}
          title="Draw Track (4)"
        >
          <PenTool size={24} />
        </button>

        <button 
          className={`toolbar-btn ${mode === 'play' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'play' ? 'select' : 'play')}
          title="Play Mode (5)"
        >
          <Play size={24} />
        </button>
      </div>

      <div className="toolbar glass-panel">

      <button 
        className="toolbar-btn"
        onClick={() => undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={24} />
      </button>

      <button 
        className="toolbar-btn"
        onClick={() => redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={24} />
      </button>

      <button 
        className={`toolbar-btn ${selectedBlockIds.length > 0 || selectedTrackIds.length > 0 || selectedGroupRectIds.length > 0 ? 'danger-btn' : 'disabled-btn'}`}
        onClick={deleteSelected}
        disabled={selectedBlockIds.length === 0 && selectedTrackIds.length === 0 && selectedGroupRectIds.length === 0}
        title="Delete Selected"
      >
        <Trash2 size={24} />
      </button>

      <button 
        className="toolbar-btn"
        onClick={toggleHierarchy}
        title="Toggle Hierarchy"
      >
        <LayoutList size={24} />
      </button>

      <button 
        className="toolbar-btn"
        onClick={toggleSettings}
        title="Settings"
      >
        <Settings size={24} />
      </button>

      <button 
        className="toolbar-btn"
        onClick={toggleHelp}
        title="Help & Shortcuts"
      >
        <HelpCircle size={24} />
      </button>
      </div>
    </>
  );
};
