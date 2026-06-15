import React from 'react';
import { useStore } from '../store/useStore';
import { Settings, Music, Trash2, Undo2, Redo2, LayoutList } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { togglePiano, toggleSettings, toggleHierarchy, deleteSelectedBlocks, selectedBlockIds } = useStore();
  const { undo, redo } = useStore.temporal.getState();

  return (
    <div className="toolbar glass-panel">
      <button 
        className="toolbar-btn primary-btn"
        onClick={togglePiano}
        title="Add Note (Piano)"
      >
        <Music size={24} />
      </button>

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
        className={`toolbar-btn ${selectedBlockIds.length > 0 ? 'danger-btn' : 'disabled-btn'}`}
        onClick={deleteSelectedBlocks}
        disabled={selectedBlockIds.length === 0}
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
    </div>
  );
};
