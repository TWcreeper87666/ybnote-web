import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Music, FileDown, Play, Pause,
  Undo2, Redo2, ZoomIn, Volume2, Blocks, ChevronDown
} from 'lucide-react';
import { Midi } from '@tonejs/midi';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import type { EditorNote, EditorTrack, ParsedMidiData } from '../../store/useLevelEditorStore';
import { useStore } from '../../store/useStore';
import { exportLevel } from '../../utils/levelUtils';
import { exportToMidiFile } from '../../utils/midiExport';
import { HelpModal } from './HelpModal';
import { ToolbarButton } from '../ui/ToolbarButton';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

export const LevelEditorToolbar: React.FC = () => {
  const navigate = useNavigate();
  const store = useLevelEditorStore();
  const mainStore = useStore();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);

  const [showHelp, setShowHelp] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // --- Import Audio ---
  const handleAudioImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const url = URL.createObjectURL(file);
      store.setAudioFile(file, audioBuffer, url);
      ctx.close();
    } catch (err) {
      console.error('Failed to decode audio:', err);
      alert('Failed to decode audio file.');
    }
    // Reset input so re-importing the same file works
    e.target.value = '';
  };

  // --- Import MIDI ---
  const handleMidiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);

      let bpm = 120; // Hardcode to 120 as per user request

      const tracks: EditorTrack[] = [];
      midi.tracks.forEach((track, index) => {
        if (track.notes.length === 0) return;

        const notes: EditorNote[] = track.notes.map((n, ni) => ({
          id: `t${index}-n${ni}-${Date.now()}`,
          pitch: n.midi,
          name: n.name,
          timeStart: n.time,
          duration: n.duration,
          velocity: n.velocity,
        }));

        const instrument = track.instrument.percussion
          ? 'percussion'
          : (track.instrument.number >= 32 && track.instrument.number <= 39)
            ? 'bass'
            : (track.instrument.number >= 80 && track.instrument.number <= 87)
              ? 'synth'
              : 'piano';

        tracks.push({
          id: index,
          name: track.name || `Track ${index + 1}`,
          notes,
          instrument,
        });
      });

      const parsedData: ParsedMidiData = {
        bpm,
        duration: midi.duration,
        tracks,
      };

      store.setMidiData(parsedData);

      // Also generate game blocks/events for the Block Arrangement tab
      generateGameData(parsedData);
    } catch (err) {
      console.error('Failed to parse MIDI:', err);
      alert('Failed to parse MIDI file.');
    }
    e.target.value = '';
  };

  // --- Generate game data from MIDI for block arrangement ---
  const generateGameData = (data: ParsedMidiData) => {
    const uniqueNotes = new Map<string, { pitch: string; instrument: string }>();

    for (const track of data.tracks) {
      for (const note of track.notes) {
        const pitchName = note.name;
        const key = `${pitchName}-${track.instrument}`;
        if (!uniqueNotes.has(key)) {
          uniqueNotes.set(key, { pitch: pitchName, instrument: track.instrument });
        }
      }
    }

    const gameBlocks: typeof mainStore.gameBlocks = [];
    const gameEvents: typeof mainStore.gameEvents = [];
    const blockIdMap = new Map<string, string>();
    const generateId = () => Math.random().toString(36).substring(2, 9);

    const cols = 8;
    const camera = mainStore.camera;
    const centerX = window.innerWidth / 2;
    const localCenterX = (centerX - camera.x) / camera.zoom;
    const startX = localCenterX - (cols * 80) / 2;
    const localStartY = (100 - camera.y) / camera.zoom;

    let i = 0;
    for (const [key, info] of uniqueNotes.entries()) {
      const id = generateId();
      blockIdMap.set(key, id);
      gameBlocks.push({
        id,
        x: startX + (i % cols) * 80,
        y: localStartY + Math.floor(i / cols) * 80,
        pitch: info.pitch,
        instrument: info.instrument,
        volume: 1,
      });
      i++;
    }

    for (const track of data.tracks) {
      for (const note of track.notes) {
        const key = `${note.name}-${track.instrument}`;
        const blockId = blockIdMap.get(key)!;
        gameEvents.push({
          time: note.timeStart * 1000,
          pitch: note.name,
          instrument: track.instrument,
          blockId,
        });
      }
    }

    gameEvents.sort((a, b) => a.time - b.time);

    mainStore.setGameBlocks(gameBlocks);
    mainStore.setGameEvents(gameEvents);
    mainStore.setGameState('arrange');
  };

  // --- Export .yblevel ---
  const handleExport = async () => {
    let defaultName = 'level';
    if (store.audioFile) {
      defaultName = store.audioFile.name.replace(/\.[^/.]+$/, ""); // Strip extension
    }
    const fileName = window.prompt("請輸入匯出檔案名稱：", defaultName);
    if (!fileName) {
      return; // user cancelled
    }

    setIsExporting(true);

    // Sync gameEvents one last time before export
    const gameEvents: typeof mainStore.gameEvents = [];
    if (store.midiData) {
      for (const track of store.midiData.tracks) {
        for (const note of track.notes) {
          const block = mainStore.gameBlocks.find(b => b.pitch === note.name && b.instrument === track.instrument);
          if (block) {
            gameEvents.push({
              time: note.timeStart * 1000,
              pitch: note.name,
              instrument: track.instrument,
              blockId: block.id,
            });
          }
        }
      }
      gameEvents.sort((a, b) => a.time - b.time);
    }

    try {
      const blob = await exportLevel({
        bpm: store.bpm,
        offset: store.offset,
        trimStart: 0, // Default to 0 for now
        trimEnd: store.chartEndPosition,
        audioBuffer: store.audioBuffer,
        midiData: store.midiData,
        gameBlocks: mainStore.gameBlocks,
        gameEvents: gameEvents,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.yblevel`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export level.');
    }
    setIsExporting(false);
  };

  const handleExportMidi = () => {
    if (store.midiData) {
      exportToMidiFile(store.midiData);
    }
  };



  return (
    <>
      <div className="le-toolbar">
        {/* Left Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* File Dropdown */}
          <div style={{ position: 'relative' }}>
            <ToolbarButton 
              variant="editor"
              active={showFileMenu} 
              onClick={() => setShowFileMenu(!showFileMenu)}
              style={{ padding: '8px 14px' }}
            >
              File
              <ChevronDown size={14} style={{ marginLeft: 2, opacity: 0.7 }} />
            </ToolbarButton>

            {showFileMenu && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 35 }} 
                  onClick={() => setShowFileMenu(false)} 
                />
                <div 
                  className="le-context-menu" 
                  style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 40 }}
                >
                  <button className="le-cm-item" onClick={() => { audioInputRef.current?.click(); setShowFileMenu(false); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Upload size={14} /> Import Audio
                    </div>
                  </button>
                  <button className="le-cm-item" onClick={() => { midiInputRef.current?.click(); setShowFileMenu(false); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Music size={14} /> Import MIDI
                    </div>
                  </button>
                  <div className="le-cm-divider" />
                  <button 
                    className="le-cm-item" 
                    onClick={() => { handleExportMidi(); setShowFileMenu(false); }} 
                    disabled={!store.midiData}
                    style={{ opacity: store.midiData ? 1 : 0.5 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Music size={14} /> Export .mid
                    </div>
                  </button>
                  <button 
                    className="le-cm-item" 
                    onClick={() => { handleExport(); setShowFileMenu(false); }} 
                    disabled={isExporting}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileDown size={14} /> Export .yblevel
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="le-toolbar-divider" style={{ margin: '0 8px' }} />

          {/* Tab Selection */}
          <div className="le-toolbar-btn-group" style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.2)', padding: 2, borderRadius: 14 }}>
            <ToolbarButton
              variant="editor"
              active={store.activeTab === 'pianoroll'}
              onClick={() => store.setActiveTab('pianoroll')}
              title="Piano Roll"
              style={{ borderRadius: 12 }}
              icon={<Music size={16} />}
            >
              <span>Editor</span>
            </ToolbarButton>
            <ToolbarButton
              variant="editor"
              active={store.activeTab === 'blocks'}
              onClick={() => store.setActiveTab('blocks')}
              title="Block Arrangement"
              style={{ borderRadius: 12 }}
              icon={<Blocks size={16} />}
            >
              <span>Blocks</span>
            </ToolbarButton>
          </div>
        </div>

        {/* Center Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ToolbarButton
            variant="editor"
            active={store.isPlaying}
            onClick={() => store.togglePlayback()}
            title={store.isPlaying ? 'Pause' : 'Play'}
            icon={store.isPlaying ? <Pause size={20} /> : <Play size={20} />}
          />
          <div style={{ fontFamily: 'monospace', fontSize: 16, minWidth: 50, textAlign: 'center', opacity: 0.9, color: '#fff' }}>
            {formatTime(store.playbackPosition)}
          </div>
          <select 
            value={store.audioPlaybackRate} 
            onChange={(e) => store.setAudioPlaybackRate(Number(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem', outline: 'none', cursor: 'pointer', marginLeft: -4 }}
            tabIndex={-1}
            title="Playback Speed"
            onFocus={(e) => e.target.blur()}
            onKeyDown={(e) => e.preventDefault()}
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ToolbarButton variant="editor" onClick={() => store.undo()} disabled={store.historyIndex <= 0} title="Undo (Ctrl+Z)" icon={<Undo2 size={18} />} />
          <ToolbarButton variant="editor" onClick={() => store.redo()} disabled={store.historyIndex >= store.history.length - 1} title="Redo (Ctrl+Y)" icon={<Redo2 size={18} />} />

          <div className="le-toolbar-divider" style={{ margin: '0 8px' }} />

          <div className="le-toolbar-btn" style={{ cursor: 'default' }} title="Zoom">
            <ZoomIn size={18} style={{ marginRight: 4 }} />
            <input 
              type="range" 
              min="10" max="500" step="10" 
              value={store.zoomLevel} 
              onChange={(e) => store.setZoomLevel(Number(e.target.value))}
              style={{ width: 60, accentColor: '#a5b4fc' }}
              tabIndex={-1}
              onFocus={(e) => e.target.blur()}
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>

          <div className="le-toolbar-btn" style={{ cursor: 'default' }} title="Audio Volume">
            <Volume2 size={16} style={{ marginRight: 4, color: '#4ae2a8' }} />
            <input 
              type="range" 
              min="0" max="100" 
              value={store.audioVolume} 
              onChange={(e) => store.setAudioVolume(Number(e.target.value))}
              style={{ width: 50, accentColor: '#4ae2a8' }}
              tabIndex={-1}
              onFocus={(e) => e.target.blur()}
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>
          
          <div className="le-toolbar-btn" style={{ cursor: 'default' }} title="MIDI Volume">
            <Music size={16} style={{ marginRight: 4, color: '#a5b4fc' }} />
            <input 
              type="range" 
              min="0" max="100" 
              value={store.midiVolume} 
              onChange={(e) => store.setMidiVolume(Number(e.target.value))}
              style={{ width: 50, accentColor: '#a5b4fc' }}
              tabIndex={-1}
              onFocus={(e) => e.target.blur()}
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>

          <ToolbarButton variant="editor" onClick={() => setShowHelp(true)} title="Help & Shortcuts">
            <span style={{ fontWeight: 'bold', fontSize: 16 }}>?</span>
          </ToolbarButton>

          {store.audioFile && (
            <div className="le-status-badge" title={store.audioFile.name}>
              🎵 {store.audioFile.name.length > 16
                ? store.audioFile.name.slice(0, 14) + '...'
                : store.audioFile.name}
            </div>
          )}

          {store.midiData && (
            <div className="le-status-badge">
              🎹 {store.midiData.tracks.length} track{store.midiData.tracks.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={audioInputRef}
          type="file"
          accept=".mp3,.wav,.ogg,.m4a,.flac"
          style={{ display: 'none' }}
          onChange={handleAudioImport}
        />

        <input
          ref={midiInputRef}
          type="file"
          accept=".mid,.midi"
          style={{ display: 'none' }}
          onChange={handleMidiImport}
        />
      </div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
};
