import React from 'react';
import { useStore } from '../store/useStore';
import { Settings, Music, Drum, Trash2, Undo2, Redo2, LayoutList, PenTool, HelpCircle } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { togglePiano, toggleSettings, toggleHelp, toggleHierarchy, deleteSelected, selectedBlockIds, selectedTrackIds, mode, setMode } = useStore();
  const { undo, redo } = useStore.temporal.getState();

  const addDrumBlock = () => {
    const state = useStore.getState();
    const cx = state.camera.x;
    const cy = state.camera.y;
    const zoom = state.camera.zoom;
    const centerX = (window.innerWidth / 2 - cx) / zoom;
    const centerY = (window.innerHeight / 2 - cy) / zoom;
    
    let newX = centerX - 30;
    let newY = centerY - 30;
    
    if (state.snapToGrid) {
       const gridSize = 60;
       newX = Math.round(newX / gridSize) * gridSize;
       newY = Math.round(newY / gridSize) * gridSize;
    }
    
    state.addBlock({ pitch: 'kick', x: newX, y: newY, instrument: 'percussion' });
  };

  return (
    <div className="toolbar glass-panel">
      <div className="toolbar-group">
        <button 
          className={`toolbar-btn ${mode === 'draw_track' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'draw_track' ? 'select' : 'draw_track')}
          title="Draw Track (Bezier)"
        >
          <PenTool size={24} />
        </button>

        <button 
          className={`toolbar-btn ${mode === 'piano' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'piano' ? 'select' : 'piano')}
          title="Add Note (Piano Mode)"
        >
          <Music size={24} />
        </button>

        <button 
          className={`toolbar-btn ${mode === 'drum' ? 'primary-btn' : ''}`}
          onClick={() => setMode(mode === 'drum' ? 'select' : 'drum')}
          title="Add Drum Block (Drum Mode)"
        >
          <Drum size={24} />
        </button>
      </div>

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
        className={`toolbar-btn ${selectedBlockIds.length > 0 || selectedTrackIds.length > 0 ? 'danger-btn' : 'disabled-btn'}`}
        onClick={deleteSelected}
        disabled={selectedBlockIds.length === 0 && selectedTrackIds.length === 0}
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
  );
};
