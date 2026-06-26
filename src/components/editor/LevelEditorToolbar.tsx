import React, { useRef, useState } from 'react';
import {
  Upload, Music, FileDown, Play, Pause,
  Undo2, Redo2, ZoomIn, Volume2, Blocks, ChevronDown, Settings, RefreshCw, Target
} from 'lucide-react';
import { Midi } from '@tonejs/midi';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import type { EditorNote, EditorTrack, ParsedMidiData } from '../../types';
import { exportLevel, importLevel } from '../../utils/levelUtils';
import { exportToMidiFile } from '../../utils/midiExport';
import { HelpModal } from './HelpModal';
import { ExportModal } from './ExportModal';
import { ConvertModal } from './ConvertModal';
import { ToolbarButton } from '../ui/ToolbarButton';
import { buildGameEventsFromMidi, syncCanvasToGameBlocks, syncGameEventsFromMidi } from '../../utils/chartUtils';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

export const LevelEditorToolbar: React.FC = () => {
  const store = useLevelEditorStore();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);
  const yblevelInputRef = useRef<HTMLInputElement>(null);

  const [showHelp, setShowHelp] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [arrangeBy, setArrangeBy] = useState<'sequence' | 'pitch'>('sequence');

  // --- Helpers ---
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

      const bpm = 120; // Hardcode to 120 as per user request

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

      store.appendMidiData(parsedData);
    } catch (err) {
      console.error('Failed to parse MIDI:', err);
      alert('Failed to parse MIDI file.');
    }
    e.target.value = '';
  };

  // --- Import .yblevel ---
  const handleYblevelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importLevel(file);
      
      if (imported.audioBlob && imported.audioBuffer) {
        const url = URL.createObjectURL(imported.audioBlob);
        store.setAudioFile(new File([imported.audioBlob], 'audio.mp3'), imported.audioBuffer, url);
      } else {
        store.removeAudio();
      }

      store.setBpm(imported.levelData.bpm);
      store.setOffset(imported.levelData.offset);
      useLevelEditorStore.setState({
        levelTitle: imported.levelData.title || '',
        levelAuthor: imported.levelData.author || '',
        levelDescription: imported.levelData.description || '',
        levelMidiCredit: imported.levelData.midiCredit || '',
      });

      const tracksMap = new Map<number, EditorTrack>();
      imported.levelData.midiNotes.forEach(n => {
        const tId = n.trackId ?? 0;
        if (!tracksMap.has(tId)) {
          tracksMap.set(tId, {
            id: tId,
            name: n.trackName || `Track ${tId + 1}`,
            instrument: (n.trackInstrument as 'piano' | 'bass' | 'synth' | 'percussion') || 'piano',
            notes: []
          });
        }
        tracksMap.get(tId)!.notes.push({
          id: n.id,
          pitch: n.pitch,
          name: n.name,
          timeStart: n.timeStart,
          duration: n.duration,
          velocity: n.velocity,
          ...(n.targetId ? { targetId: n.targetId } : {}),
          ...(n.targetType ? { targetType: n.targetType } : {}),
        });
      });
      
      const tracks = Array.from(tracksMap.values());
      if (tracks.length === 0) {
        tracks.push({ id: 0, name: 'Track 1', notes: [], instrument: 'piano' });
      }
      
      const parsedData: ParsedMidiData = {
        bpm: imported.levelData.bpm,
        duration: imported.levelData.trimEnd || 60,
        tracks,
      };

      store.setMidiData(parsedData);
      
      store.setBlocks(imported.levelData.blocks);
      store.setGameEvents(imported.levelData.events);
      syncGameEventsFromMidi(parsedData);
      store.commitHistory();

    } catch (err) {
      console.error('Failed to import .yblevel:', err);
      alert('Failed to import .yblevel file.');
    }
    e.target.value = '';
  };

  // --- Export .yblevel ---
  const handleExport = async (fileName: string, compressAudio: boolean) => {
    setIsExporting(true);
    syncCanvasToGameBlocks();

    const gameEvents = store.midiData
      ? buildGameEventsFromMidi(store.midiData)
      : [];

    try {
      const blob = await exportLevel({
        bpm: store.bpm,
        offset: store.offset,
        trimStart: 0, // Default to 0 for now
        trimEnd: store.chartEndPosition,
        audioBuffer: store.audioBuffer,
        audioFile: store.audioFile,
        compressAudio,
        midiData: store.midiData,
        title: store.levelTitle,
        author: store.levelAuthor,
        description: store.levelDescription,
        midiCredit: store.levelMidiCredit,
        musicCredit: store.levelMusicCredit,
        gameBlocks: store.blocks,
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
    setShowExportModal(false);
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
                  <button className="le-cm-item" onClick={() => { yblevelInputRef.current?.click(); setShowFileMenu(false); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Upload size={14} /> Import .yblevel
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
                    onClick={() => { setShowExportModal(true); setShowFileMenu(false); }} 
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
            <ToolbarButton
              variant="editor"
              active={store.activeTab === 'charting'}
              onClick={() => store.setActiveTab('charting')}
              title="Charting"
              style={{ borderRadius: 12 }}
              icon={<Target size={16} />}
            >
              <span>Charting</span>
            </ToolbarButton>
          </div>

          <ToolbarButton
            variant="editor"
            onClick={() => setShowConvertModal(true)}
            title="Convert — 補齊方塊 / Auto-Chart"
            icon={<RefreshCw size={16} />}
            style={{ marginLeft: 6 }}
          >
            Convert
          </ToolbarButton>
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
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2.0}>2.0x</option>
          </select>
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ToolbarButton variant="editor" onClick={() => store.undo()} disabled={store.historyIndex <= 0} title="Undo (Ctrl+Z)" icon={<Undo2 size={18} />} />
          <ToolbarButton variant="editor" onClick={() => store.redo()} disabled={store.historyIndex >= store.history.length - 1} title="Redo (Ctrl+Y)" icon={<Redo2 size={18} />} />

          <div className="le-toolbar-divider" style={{ margin: '0 8px' }} />

          {/* Settings Dropdown */}
          <div style={{ position: 'relative' }}>
            <ToolbarButton 
              variant="editor"
              active={showSettingsMenu} 
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Editor Settings"
            >
              <Settings size={18} />
            </ToolbarButton>

            {showSettingsMenu && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 35 }} 
                  onClick={() => setShowSettingsMenu(false)} 
                />
                <div 
                  className="le-context-menu" 
                  style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 40, width: 240, padding: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: '#9ca3af', fontSize: 13, fontWeight: 600 }}>EDITOR SETTINGS</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'white', fontSize: 13 }}>BPM</span>
                    <input 
                      type="number" 
                      value={store.bpm} 
                      onChange={(e) => store.setBpm(Number(e.target.value))}
                      style={{ width: 60, padding: '4px 8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'white', fontSize: 13 }}>Sort Blocks By</span>
                    <select 
                      value={arrangeBy} 
                      onChange={(e) => setArrangeBy(e.target.value as 'sequence' | 'pitch')}
                      style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 13, cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="sequence">Sequence</option>
                      <option value="pitch">Pitch</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'white', fontSize: 13 }} title="Maximum undo steps">Undo Limit</span>
                    <input 
                      type="number" 
                      min="1" max="500"
                      value={store.historyLimit} 
                      onChange={(e) => store.setHistoryLimit(Math.max(1, Number(e.target.value)))}
                      style={{ width: 60, padding: '4px 8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'white', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><ZoomIn size={14} /> Zoom Level</span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{store.zoomLevel}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" max="500" step="10" 
                      value={store.zoomLevel} 
                      onChange={(e) => store.setZoomLevel(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#a5b4fc' }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'white', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Volume2 size={14} color="#4ae2a8" /> Audio Volume</span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{store.audioVolume}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={store.audioVolume} 
                      onChange={(e) => store.setAudioVolume(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#4ae2a8' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'white', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Music size={14} color="#a5b4fc" /> MIDI Volume</span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{store.midiVolume}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={store.midiVolume} 
                      onChange={(e) => store.setMidiVolume(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#a5b4fc' }}
                    />
                  </div>
                </div>
              </>
            )}
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

        <input
          ref={yblevelInputRef}
          type="file"
          accept=".yblevel"
          style={{ display: 'none' }}
          onChange={handleYblevelImport}
        />
      </div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        onExport={handleExport}
        defaultFileName={store.audioFile ? store.audioFile.name.replace(/\.[^/.]+$/, "") : 'level'}
      />
      <ConvertModal isOpen={showConvertModal} onClose={() => setShowConvertModal(false)} />

      {isExporting && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          color: 'white',
        }}>
          <div style={{
             width: 64, height: 64, border: '6px solid rgba(255,255,255,0.2)',
             borderTopColor: '#a5b4fc', borderRadius: '50%',
             animation: 'spin 1s linear infinite'
          }} />
          <h2 style={{ marginTop: 24, fontSize: 28, fontWeight: 'bold' }}>Exporting .yblevel...</h2>
          <p style={{ marginTop: 12, fontSize: 16, opacity: 0.8 }}>Encoding audio and packaging files. This may take a moment.</p>
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}
    </>
  );
};
