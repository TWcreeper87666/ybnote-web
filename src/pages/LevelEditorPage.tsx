import React, { useEffect } from 'react';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { useStore } from '../store/useStore';
import { PianoRoll } from '../components/editor/PianoRoll';
import { LevelEditorToolbar } from '../components/editor/LevelEditorToolbar';
import { GameCanvas } from '../components/canvas/GameCanvas';
import { WaveformView } from '../components/editor/WaveformView';
import { TrackPanel } from '../components/editor/TrackPanel';
import { VelocityTab } from '../components/editor/VelocityTab';
import { parseMidiFile } from '../utils/midiImport';
import { FileDown } from 'lucide-react';

export const LevelEditorPage: React.FC = () => {
  const { activeTab } = useLevelEditorStore();
  const theme = useStore((s) => s.theme);
  const gameState = useStore((s) => s.gameState);
  const setGameState = useStore((s) => s.setGameState);
  const store = useLevelEditorStore();

  const [trackPanelWidth, setTrackPanelWidth] = React.useState(250);
  const [waveformHeight, setWaveformHeight] = React.useState(128);
  const [velocityHeight, setVelocityHeight] = React.useState(100);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragState = React.useRef<{ type: string; startX: number; startY: number; initialW: number; initialH: number } | null>(null);

  // Ensure game is in arrange mode for block arrangement
  useEffect(() => {
    if (activeTab === 'blocks' && gameState !== 'arrange') {
      setGameState('arrange');
    }
  }, [activeTab, gameState, setGameState]);

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
      } else if (type === 'velocity') {
        const dy = startY - e.clientY;
        setVelocityHeight(Math.max(50, Math.min(500, initialH + dy)));
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
      initialH: type === 'waveform' ? waveformHeight : velocityHeight
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
            {activeTab === 'pianoroll' && (
              <div className="le-synced-views">
                <div style={{ height: waveformHeight, flexShrink: 0, display: 'flex' }}>
                  <WaveformView />
                </div>
                <div className="le-resizer le-resizer-vertical" onMouseDown={(e) => startResize(e, 'waveform')} />
                <div className="le-pr-canvas-area">
                  <PianoRoll />
                </div>
                {store.showVelocityTab && <div className="le-resizer le-resizer-vertical" onMouseDown={(e) => startResize(e, 'velocity')} />}
                {store.showVelocityTab && (
                  <div style={{ height: velocityHeight, flexShrink: 0, display: 'flex' }}>
                    <VelocityTab />
                  </div>
                )}
              </div>
            )}
            {activeTab === 'blocks' && (
              <div className="le-blocks-container">
                <GameCanvas />
                <div className="le-blocks-hint">
                  Drag blocks to arrange your beatmap layout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
