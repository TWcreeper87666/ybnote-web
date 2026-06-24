import React from 'react';
import { useStore, undoAction, redoAction } from '../../store/useStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { Settings, Music, Drum, Trash2, Undo2, Redo2, LayoutList, LayoutGrid, PenTool, HelpCircle, Square, Wand2, Circle, Upload } from 'lucide-react';
import { exportRecordedEventsToMidi } from '../../utils/midiUtils';
import { ToolbarButton } from './ToolbarButton';
import { isLevelEditor } from '../../utils/routeUtils';
import { ToolbarDivider } from './ToolbarDivider';

export const Toolbar: React.FC = () => {
  // Canvas-specific state from context store (works for both playground and level editor)
  const mode = useCanvasStore((s) => s.mode);
  const setMode = useCanvasStore((s) => s.setMode);
  const selectedBlockIds = useCanvasStore((s) => s.selectedBlockIds);
  const selectedTrackIds = useCanvasStore((s) => s.selectedTrackIds);
  const selectedGroupRectIds = useCanvasStore((s) => s.selectedGroupRectIds);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);

  // UI-only state still from global store (settings panel, outliner, pocket, etc.)
  const { toggleSettings, toggleHelp, toggleOutliner, togglePocketCanvas, isRecording, startRecording, stopRecording, gameState, isOutlinerOpen, isPocketCanvasOpen } = useStore();

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
      </div>
      )}

      <div className="toolbar glass-panel">

      {!isLevelEditor() && (
        <>
          <ToolbarButton
            onClick={undoAction}
            title="Undo"
            icon={<Undo2 size={24} />}
          />
          <ToolbarButton
            onClick={redoAction}
            title="Redo"
            icon={<Redo2 size={24} />}
          />
        </>
      )}

      <ToolbarButton
        className={selectedBlockIds.length > 0 || selectedTrackIds.length > 0 || selectedGroupRectIds.length > 0 ? 'danger-btn' : 'disabled-btn'}
        onClick={deleteSelected}
        disabled={selectedBlockIds.length === 0 && selectedTrackIds.length === 0 && selectedGroupRectIds.length === 0}
        title="Delete Selected"
        icon={<Trash2 size={24} />}
      />

      <ToolbarDivider variant="editor" orientation="horizontal" />

      <ToolbarButton
        onClick={toggleOutliner}
        title="Toggle Outliner"
        icon={<LayoutList size={24} />}
        active={isOutlinerOpen}
        variant="panel-toggle"
      />

      <ToolbarButton
        onClick={togglePocketCanvas}
        title="Toggle Pocket Canvas"
        icon={<LayoutGrid size={24} />}
        active={isPocketCanvasOpen}
        variant="panel-toggle"
      />

      <ToolbarDivider variant="editor" orientation="horizontal" />

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
