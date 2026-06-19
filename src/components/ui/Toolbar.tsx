import React from 'react';
import { useStore, undoAction, redoAction } from '../../store/useStore';
import { Settings, Music, Drum, Trash2, Undo2, Redo2, LayoutList, PenTool, HelpCircle, Square, Wand2, Circle, Download, Upload, Gamepad2 } from 'lucide-react';
import { exportRecordedEventsToMidi, importMidiToBlocks } from '../../utils/midiUtils';
import { useNavigate } from 'react-router-dom';

export const Toolbar: React.FC = () => {
  const { toggleSettings, toggleHelp, toggleHierarchy, deleteSelected, selectedBlockIds, selectedTrackIds, selectedGroupRectIds, mode, setMode, isRecording, startRecording, stopRecording } = useStore();
  const navigate = useNavigate();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMidiToBlocks(file).catch(console.error);
    }
  };


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
          <Square size={24} fill="currentColor" />
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
          title="Perform Mode (5)"
        >
          <Wand2 size={24} />
        </button>

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />

        <button 
          className={`toolbar-btn ${isRecording ? 'danger-btn' : ''}`}
          onClick={() => isRecording ? stopRecording() : startRecording()}
          title={isRecording ? "Stop Recording" : "Record Macro"}
        >
          <Circle size={24} fill={isRecording ? 'currentColor' : 'none'} />
        </button>

        <button 
          className="toolbar-btn"
          onClick={exportRecordedEventsToMidi}
          title="Export Recording to MIDI"
        >
          <Upload size={24} />
        </button>

        <label className="toolbar-btn" title="Import MIDI" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Download size={24} />
          <input type="file" accept=".mid,.midi" style={{ display: 'none' }} onChange={handleImport} />
        </label>
      </div>

      <div className="toolbar glass-panel">

      <button 
        className="toolbar-btn glass-panel" 
        onClick={() => undoAction()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={24} />
      </button>
      <button 
        className="toolbar-btn glass-panel" 
        onClick={() => redoAction()}
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
        onClick={() => navigate('/game')}
        title="Enter Game Mode"
      >
        <Gamepad2 size={24} />
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
