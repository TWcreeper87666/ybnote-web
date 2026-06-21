import React from 'react';
import { useStore, undoAction, redoAction } from '../../store/useStore';
import { Settings, Music, Drum, Trash2, Undo2, Redo2, LayoutList, PenTool, HelpCircle, Square, Wand2, Circle, Download, Upload } from 'lucide-react';
import { exportRecordedEventsToMidi, importMidiToBlocks } from '../../utils/midiUtils';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';

export const Toolbar: React.FC = () => {
  const { toggleSettings, toggleHelp, toggleOutliner, deleteSelected, selectedBlockIds, selectedTrackIds, selectedGroupRectIds, mode, setMode, isRecording, startRecording, stopRecording, gameState } = useStore();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMidiToBlocks(file).catch(console.error);
    }
  };


  return (
    <>
      {gameState !== 'arrange' && (
      <div className="top-toolbar glass-panel" style={{ gap: '8px' }}>
        <ToolbarButton 
          active={mode === 'piano'}
          onClick={() => setMode(mode === 'piano' ? 'select' : 'piano')}
          title="Add Note (1)"
          icon={<Music size={24} />}
        />

        <ToolbarButton 
          active={mode === 'drum'}
          onClick={() => setMode(mode === 'drum' ? 'select' : 'drum')}
          title="Add Drum Block (2)"
          icon={<Drum size={24} />}
        />

        <ToolbarButton 
          active={mode === 'draw_group'}
          onClick={() => setMode(mode === 'draw_group' ? 'select' : 'draw_group')}
          title="Draw Group (3)"
          icon={<Square size={24} fill="currentColor" />}
        />

        <ToolbarButton 
          active={mode === 'draw_track'}
          onClick={() => setMode(mode === 'draw_track' ? 'select' : 'draw_track')}
          title="Draw Track (4)"
          icon={<PenTool size={24} />}
        />

        <ToolbarButton 
          active={mode === 'play'}
          onClick={() => setMode(mode === 'play' ? 'select' : 'play')}
          title="Perform Mode (5)"
          icon={<Wand2 size={24} />}
        />

        <ToolbarDivider variant="playground" />

        <ToolbarButton 
          className={isRecording ? 'danger-btn' : ''}
          onClick={() => isRecording ? stopRecording() : startRecording()}
          title={isRecording ? "Stop Recording" : "Record Macro"}
          icon={<Circle size={24} fill={isRecording ? 'currentColor' : 'none'} />}
        />

        <ToolbarButton 
          onClick={exportRecordedEventsToMidi}
          title="Export Recording to MIDI"
          icon={<Upload size={24} />}
        />

        <label className="toolbar-btn" title="Import MIDI" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Download size={24} />
          <input type="file" accept=".mid,.midi" style={{ display: 'none' }} onChange={handleImport} />
        </label>
      </div>
      )}

      <div className="toolbar glass-panel">

      <ToolbarButton 
        onClick={() => undoAction()}
        title="Undo (Ctrl+Z)"
        icon={<Undo2 size={24} />}
      />
      <ToolbarButton 
        onClick={() => redoAction()}
        title="Redo (Ctrl+Y)"
        icon={<Redo2 size={24} />}
      />

      <ToolbarButton 
        className={selectedBlockIds.length > 0 || selectedTrackIds.length > 0 || selectedGroupRectIds.length > 0 ? 'danger-btn' : 'disabled-btn'}
        onClick={deleteSelected}
        disabled={selectedBlockIds.length === 0 && selectedTrackIds.length === 0 && selectedGroupRectIds.length === 0}
        title="Delete Selected"
        icon={<Trash2 size={24} />}
      />

      <ToolbarButton 
        onClick={toggleOutliner}
        title="Toggle Outliner"
        icon={<LayoutList size={24} />}
      />

      <ToolbarButton 
        onClick={toggleSettings}
        title="Settings"
        icon={<Settings size={24} />}
      />

      <ToolbarButton 
        onClick={toggleHelp}
        title="Help & Shortcuts"
        icon={<HelpCircle size={24} />}
      />
      </div>
    </>
  );
};
