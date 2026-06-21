import React, { useEffect } from 'react';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { useStore } from '../store/useStore';
import { PianoRoll } from '../components/editor/PianoRoll';
import { LevelEditorToolbar } from '../components/editor/LevelEditorToolbar';
import { GameCanvas } from '../components/canvas/GameCanvas';
import { WaveformView } from '../components/editor/WaveformView';
import { TrackPanel } from '../components/editor/TrackPanel';
import { parseMidiFile } from '../utils/midiImport';
import { FileDown, Play, Pause, Volume2 } from 'lucide-react';
import { Toolbar } from '../components/ui/Toolbar';
import { SettingsPanel } from '../components/ui/SettingsPanel';
import { SelectionPropertiesHud } from '../components/ui/SelectionPropertiesHud';
import { ContextMenu } from '../components/ui/ContextMenu';
import { HelpPanel } from '../components/ui/HelpPanel';
import { OutlinerPanel } from '../components/ui/OutlinerPanel';
import { useShortcuts } from '../hooks/useShortcuts';

const ShortcutsEnabler = () => {
  useShortcuts();
  return null;
};

const BlocksPlaybackSync = () => {
  React.useEffect(() => {
    let rafId: number;
    let lastPlayedIndex = 0;
    
    const tick = () => {
      const state = useLevelEditorStore.getState();
      if (state.isPlaying) {
        const events = useStore.getState().gameEvents;
        const currentMs = state.playbackPosition * 1000;
        
        // Handle seek backwards or wrap around
        if (lastPlayedIndex > 0 && events[lastPlayedIndex - 1]?.time > currentMs) {
          lastPlayedIndex = events.findIndex(e => e.time >= currentMs);
          if (lastPlayedIndex === -1) lastPlayedIndex = events.length;
        }
        
        while (lastPlayedIndex < events.length && events[lastPlayedIndex].time <= currentMs) {
          const ev = events[lastPlayedIndex];
          // Update gameBlock visual state (NoteBlock.tsx will flash)
          useStore.getState().updateGameBlock(ev.blockId, { playedAt: Date.now() });
          lastPlayedIndex++;
        }
      } else {
        const events = useStore.getState().gameEvents;
        const currentMs = state.playbackPosition * 1000;
        const idx = events.findIndex(e => e.time >= currentMs);
        lastPlayedIndex = idx !== -1 ? idx : events.length;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
  
  return null;
};

const MiniPlayerSlider = () => {
  const store = useLevelEditorStore();
  const wasPlayingRef = React.useRef(false);
  const [localVal, setLocalVal] = React.useState<number | null>(null);

  const handlePointerDown = () => {
    wasPlayingRef.current = useLevelEditorStore.getState().isPlaying;
    if (wasPlayingRef.current) {
      store.stopPlayback();
    }
    setLocalVal(store.playbackPosition);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalVal(val);
    store.setPlaybackAnchor(val);
  };

  const handlePointerUp = () => {
    setLocalVal(null);
    if (wasPlayingRef.current && !useLevelEditorStore.getState().isPlaying) {
      store.togglePlayback();
    }
  };

  return (
    <input 
      type="range"
      min="0"
      max={store.chartEndPosition || 100}
      step="0.1"
      value={localVal !== null ? localVal : store.playbackPosition}
      onChange={handleChange}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onFocus={(e) => e.target.blur()}
      onKeyDown={(e) => e.preventDefault()}
      tabIndex={-1}
      style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
    />
  );
};

const GlobalPlayhead = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let rafId: number;
    const update = () => {
      if (ref.current) {
        const state = useLevelEditorStore.getState();
        const x = state.playbackPosition * state.zoomLevel - state.scrollLeft;
        ref.current.style.transform = `translateX(${x}px)`;
        ref.current.style.opacity = x < 0 ? '0' : '1';
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 60, right: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 50 }}>
      <div 
        ref={ref}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 2,
          backgroundColor: '#ffcc00',
          boxShadow: '0 0 6px rgba(255, 204, 0, 0.6)'
        }}
      />
    </div>
  );
};

export const LevelEditorPage: React.FC = () => {
  const { activeTab } = useLevelEditorStore();
  const theme = useStore((s) => s.theme);
  const gameState = useStore((s) => s.gameState);
  const setGameState = useStore((s) => s.setGameState);
  const store = useLevelEditorStore();

  const [trackPanelWidth, setTrackPanelWidth] = React.useState(250);
  const [waveformHeight, setWaveformHeight] = React.useState(128);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragState = React.useRef<{ type: string; startX: number; startY: number; initialW: number; initialH: number } | null>(null);

  const generateMissingBlocks = React.useCallback(() => {
    const midiData = useLevelEditorStore.getState().midiData;
    const mainState = useStore.getState();
    if (!midiData) return;

    const uniqueNotes = new Map<string, { pitch: string; instrument: string }>();

    for (const track of midiData.tracks) {
      for (const note of track.notes) {
        const pitchName = note.name;
        const key = `${pitchName}-${track.instrument}`;
        if (!uniqueNotes.has(key)) {
          uniqueNotes.set(key, { pitch: pitchName, instrument: track.instrument });
        }
      }
    }

    const currentBlocks = [...mainState.gameBlocks];
    let added = false;
    
    // Spawn new blocks nicely in a grid
    let i = 0;
    const cols = 8;
    const camera = mainState.camera;
    const centerX = window.innerWidth / 2;
    const localCenterX = (centerX - camera.x) / camera.zoom;
    const startX = localCenterX - (cols * 80) / 2;
    const localStartY = (100 - camera.y) / camera.zoom;

    for (const info of uniqueNotes.values()) {
      const exists = currentBlocks.some(b => b.pitch === info.pitch && b.instrument === info.instrument);
      if (!exists) {
        const id = Math.random().toString(36).substring(2, 9);
        currentBlocks.push({
          id,
          x: startX + (i % cols) * 80,
          y: localStartY + Math.floor(i / cols) * 80,
          pitch: info.pitch,
          instrument: info.instrument,
          volume: 1,
        });
        added = true;
      }
      // increment i even for existing blocks to maintain grid structure for newly added ones
      i++; 
    }
    
    // Sync gameEvents to match current midiData
    const gameEvents: typeof mainState.gameEvents = [];
    for (const track of midiData.tracks) {
      for (const note of track.notes) {
        const block = currentBlocks.find(b => b.pitch === note.name && b.instrument === track.instrument);
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
    mainState.setGameEvents(gameEvents);
    
    if (added) {
      mainState.setGameBlocks(currentBlocks);
    }
  }, []);

  // Ensure game is in arrange mode for block arrangement
  useEffect(() => {
    if (activeTab === 'blocks') {
      if (gameState !== 'arrange') {
        setGameState('arrange');
      }
      generateMissingBlocks();
    }
  }, [activeTab, gameState, setGameState, generateMissingBlocks]);

  // Prevent global browser zoom via Ctrl+Wheel
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', preventZoom, { passive: false });
    return () => window.removeEventListener('wheel', preventZoom);
  }, []);

  // Resizer logic
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { type, startX, startY, initialW, initialH } = dragState.current;
      
      if (type === 'track') {
        const dx = e.clientX - startX;
        setTrackPanelWidth(Math.max(150, Math.min(800, initialW + dx)));
      } else if (type === 'waveform') {
        const dy = e.clientY - startY;
        setWaveformHeight(Math.max(50, Math.min(500, initialH + dy)));
      }
    };

    const stopResize = () => {
      dragState.current = null;
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', stopResize);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', stopResize);
      useLevelEditorStore.getState().stopPlayback();
    };
  }, []);

  const startResize = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    dragState.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      initialW: trackPanelWidth,
      initialH: waveformHeight
    };
    document.body.style.cursor = type === 'track' ? 'ew-resize' : 'ns-resize';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'mid' || ext === 'midi') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const parsed = await parseMidiFile(arrayBuffer);
          store.setMidiData(parsed);
        } catch (err) {
          console.error('Failed to parse MIDI', err);
          alert('Failed to parse MIDI file');
        }
      } else if (ext === 'mp3' || ext === 'wav' || ext === 'm4a' || ext === 'ogg') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const ctx = new window.AudioContext();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const url = URL.createObjectURL(file);
          store.setAudioFile(file, audioBuffer, url);
        } catch (err) {
          console.error('Failed to parse audio', err);
          alert('Failed to parse audio file');
        }
      }
    }
  };

  return (
    <div
      className={`app-container ${theme}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {isDragging && (
        <div className="le-drag-overlay">
          <FileDown size={48} color="#a5b4fc" opacity={0.8} />
          <div className="le-drag-text">Drop Audio or MIDI files here</div>
        </div>
      )}
      <div className="le-page">
        {/* Toolbar */}
        <div className="le-header-area">
          <LevelEditorToolbar />
        </div>

        <div className="le-main-area">
          <div style={{ width: trackPanelWidth, flexShrink: 0, display: 'flex' }}>
            <TrackPanel />
          </div>
          <div className="le-resizer le-resizer-horizontal" onMouseDown={(e) => startResize(e, 'track')} />
          
          <div className="le-workspace">
            <div className="le-synced-views" style={{ display: activeTab === 'pianoroll' ? 'flex' : 'none', position: 'relative' }}>
              <GlobalPlayhead />
              <div style={{ height: waveformHeight, flexShrink: 0, display: 'flex' }}>
                <WaveformView />
              </div>
              <div className="le-resizer le-resizer-vertical" onMouseDown={(e) => startResize(e, 'waveform')} />
              <div className="le-pr-canvas-area">
                <PianoRoll />
              </div>
            </div>
            <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          visibility: activeTab === 'blocks' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'blocks' ? 'auto' : 'none'
        }}>
          <div className="le-blocks-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                <ShortcutsEnabler />
                <BlocksPlaybackSync />
                <GameCanvas />
                <div className="le-blocks-hint">
                  Drag blocks to arrange your beatmap layout
                </div>
                
                {/* Editor UI overlays for blocks mode */}
                <div className="ui-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                  <div 
                    className="ui-pointer-events"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
                    }}
                  >
                    <Toolbar />
                    <OutlinerPanel />
                    <SettingsPanel />
                    <HelpPanel />
                    <SelectionPropertiesHud />
                    <ContextMenu />
                  </div>
                </div>
                
                {/* Bottom Mini Player */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                   <div style={{ color: 'white', fontSize: 14, opacity: 0.8 }}>Preview Playback</div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <button 
                        onClick={() => store.togglePlayback()}
                        style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                      >
                        {store.isPlaying ? <Pause size={28} /> : <Play size={28} />}
                      </button>
                      
                      <MiniPlayerSlider />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <Volume2 size={20} color="white" />
                         <input 
                           type="range"
                           min="0"
                           max="100"
                           step="1"
                           value={store.audioVolume}
                           onChange={(e) => store.setAudioVolume(parseFloat(e.target.value))}
                           style={{ width: 80, accentColor: '#6366f1', cursor: 'pointer' }}
                           tabIndex={-1}
                           onFocus={(e) => e.target.blur()}
                           onKeyDown={(e) => e.preventDefault()}
                         />
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
