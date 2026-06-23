import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.js';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { EditorContextMenu, EditorContextMenuItem } from './EditorContextMenu';

const CustomWaveProgress = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (ref.current) {
        const state = useLevelEditorStore.getState();
        const w = state.playbackPosition * state.zoomLevel;
        ref.current.style.width = `${Math.max(0, w)}px`;
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div 
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
};

export const WaveformView: React.FC = () => {
  const store = useLevelEditorStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartAudioTime = useRef(0);
  const clickStart = useRef(0);

  // Middle pan state
  const isMiddlePanning = useRef(false);
  const panStartMouseX = useRef(0);
  const panStartScrollX = useRef(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // Trimming state
  const [isTrimming, setIsTrimming] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !store.audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a5b4fc',
      progressColor: '#a5b4fc', // Hide native progress by making it same as waveColor
      cursorColor: 'transparent',
      cursorWidth: 0,
      minPxPerSec: store.zoomLevel,
      autoCenter: false,
      interact: false, // We handle click/drag manually
      hideScrollbar: true,
      height: 'auto'
    });
    
    setIsLoaded(false);

    if (minimapRef.current) {
      ws.registerPlugin(Minimap.create({
        container: minimapRef.current,
        height: 20,
        waveColor: '#444',
        progressColor: '#666',
        cursorColor: 'transparent',
      }));
    }

    ws.load(store.audioUrl);
    ws.setVolume(store.audioVolume / 100);
    ws.setPlaybackRate(store.audioPlaybackRate);

    ws.on('ready', (duration) => {
      setIsLoaded(true);
      setAudioDuration(duration);
      ws.setPlaybackRate(useLevelEditorStore.getState().audioPlaybackRate);
      ws.setVolume(useLevelEditorStore.getState().audioVolume / 100);
    });

    wavesurferRef.current = ws;

    const resizeObserver = new ResizeObserver((entries) => {
      if (wavesurferRef.current) {
        wavesurferRef.current.setOptions({ height: entries[0].contentRect.height });
      }
    });
    if (wrapperRef.current) resizeObserver.observe(wrapperRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.destroy();
      wavesurferRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.audioUrl]);

  // Sync volume & playback rate from store
  useEffect(() => {
    if (wavesurferRef.current) wavesurferRef.current.setVolume(store.audioVolume / 100);
  }, [store.audioVolume]);

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(store.audioPlaybackRate);
    }
  }, [store.audioPlaybackRate]);

  // Sync zoom level
  useEffect(() => {
    if (wavesurferRef.current && isLoaded) {
      wavesurferRef.current.zoom(store.zoomLevel);
    }
  }, [store.zoomLevel, isLoaded]);

  // Sync playback position
  useEffect(() => {
    if (!wavesurferRef.current || !isLoaded) return;
    
    const ws = wavesurferRef.current;
    if (store.isPlaying) {
      const targetAudioTime = store.playbackPosition - store.audioStartTime;
      if (targetAudioTime >= 0) {
        if (!ws.isPlaying()) {
          ws.setTime(targetAudioTime);
          ws.play();
        } else {
          // drift correction
          if (Math.abs(ws.getCurrentTime() - targetAudioTime) > 0.1) {
            ws.setTime(targetAudioTime);
          }
        }
      } else {
        if (ws.isPlaying()) ws.pause();
      }
    } else {
      if (ws.isPlaying()) ws.pause();
      const targetAudioTime = store.playbackAnchor - store.audioStartTime;
      if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        ws.setTime(targetAudioTime);
      } else {
        ws.setTime(0);
      }
    }
  }, [store.isPlaying, store.playbackPosition, store.playbackAnchor, store.audioStartTime, store.audioPlaybackRate, isLoaded, audioDuration]);

  const isShiftDragging = useRef(false);
  const isScrubbing = useRef(false);
  const wasPlayingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle click panning
      e.preventDefault();
      isMiddlePanning.current = true;
      panStartMouseX.current = e.clientX;
      panStartScrollX.current = store.scrollLeft;
      // eslint-disable-next-line react-hooks/immutability
      document.body.style.cursor = 'grabbing';
      
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      return;
    }

    if (!store.audioUrl) return;
    const target = e.target as HTMLElement;
    if (target.closest('.rate-selector')) return;
    
    if (e.button === 0 && e.shiftKey) {
      isShiftDragging.current = true;
      setIsDragging(false);
      dragStartX.current = e.clientX;
      dragStartAudioTime.current = store.audioStartTime;
      // eslint-disable-next-line react-hooks/purity
      clickStart.current = Date.now();
      
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    } else if (e.button === 0) {
      isShiftDragging.current = false;
      isScrubbing.current = true;
      setIsDragging(false);
      // eslint-disable-next-line react-hooks/purity
      clickStart.current = Date.now();

      wasPlayingRef.current = store.isPlaying;
      if (store.isPlaying) store.stopPlayback();

      if (wrapperRef.current) {
        const contentEl = wrapperRef.current.querySelector('.waveform-content');
        if (contentEl) {
          const rect = contentEl.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickedTime = Math.max(0, clickX / store.zoomLevel);
          store.setPlaybackAnchor(clickedTime);
        }
      }
      
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleWindowMouseMove = (e: MouseEvent) => {
    if (isMiddlePanning.current) {
      const dx = e.clientX - panStartMouseX.current;
      store.setScrollLeft(panStartScrollX.current - dx);
      return;
    }

    if (isShiftDragging.current) {
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 3) {
        setIsDragging(true);
        const dt = dx / store.zoomLevel;
        store.setAudioStartTime(dragStartAudioTime.current + dt);
        
        if (wavesurferRef.current && !useLevelEditorStore.getState().isPlaying) {
          const targetAudioTime = store.playbackAnchor - store.audioStartTime;
          wavesurferRef.current.setTime(Math.max(0, targetAudioTime));
        }
      }
    } else if (isScrubbing.current) {
      if (wrapperRef.current) {
        const contentEl = wrapperRef.current.querySelector('.waveform-content');
        if (contentEl) {
          const rect = contentEl.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickedTime = Math.max(0, clickX / store.zoomLevel);
          store.setPlaybackAnchor(clickedTime);
        }
      }
    }
  };

  const handleWindowMouseUp = () => {
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    
    if (isMiddlePanning.current) {
      isMiddlePanning.current = false;
      // eslint-disable-next-line react-hooks/immutability
      document.body.style.cursor = '';
      return;
    }

    if (isShiftDragging.current) {
      if (isDragging) {
        useLevelEditorStore.getState().commitHistory();
      }
      isShiftDragging.current = false;
      setIsDragging(false);
    } else if (isScrubbing.current) {
      isScrubbing.current = false;
      if (wasPlayingRef.current && !useLevelEditorStore.getState().isPlaying) {
        useLevelEditorStore.getState().togglePlayback();
      }
    }
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!wrapperRef.current) return;
        const zoomDelta = e.deltaY > 0 ? -10 : 10;
        const newZoom = Math.max(10, Math.min(1000, useLevelEditorStore.getState().zoomLevel + zoomDelta));
        if (newZoom === useLevelEditorStore.getState().zoomLevel) return;

        const rect = wrapperRef.current.getBoundingClientRect();
        const physicalX = e.clientX - rect.left - 60;
        useLevelEditorStore.getState().setZoomLevel(newZoom, physicalX);
      }
    };

    const el = wrapperRef.current;
    if (el) el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  if (!store.audioUrl) {
    return (
      <div 
        className="waveform-wrapper" 
        ref={wrapperRef}
        style={{ height: '100%', minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}
      >
        No Audio Loaded
      </div>
    );
  }

  const currentTotalSeconds = Math.max(0, store.playbackAnchor - store.audioStartTime);
  const m = Math.floor(currentTotalSeconds / 60);
  const s = Math.floor(currentTotalSeconds % 60);
  const dragTimeText = `${m}:${s.toString().padStart(2, '0')}`;

  const offsetPixels = store.audioStartTime * store.zoomLevel;
  const scaledDuration = audioDuration * store.zoomLevel;

  return (
    <div 
      className="waveform-wrapper" 
      ref={wrapperRef}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 100, background: 'rgba(30,30,38,0.9)', border: '1px solid #4a90e2',
        borderRadius: 8, padding: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        display: isDragging ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', gap: 4, width: 200, pointerEvents: 'none'
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffcc00' }}>{dragTimeText}</div>
        <div ref={minimapRef} style={{ width: '100%', height: 20, background: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' }} />
      </div>

      <div className="waveform-sticky">
        <div className="waveform-content" style={{ transform: `translateX(${-store.scrollLeft}px)` }}>
          <div 
            className="waveform-draggable"
            style={{ 
              left: `${offsetPixels}px`,
              width: `${scaledDuration || 2000}px`,
            }}
          >
            <div ref={containerRef} className="waveform-container" />
          </div>
          <CustomWaveProgress />
        </div>
      </div>

      {contextMenu && (
        <EditorContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <EditorContextMenuItem onClick={async () => {
            setContextMenu(null);
            setIsTrimming(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            await store.trimAudioInPlace('start');
            setIsTrimming(false);
          }}>
            Trim before playhead
          </EditorContextMenuItem>
          <EditorContextMenuItem onClick={async () => {
            setContextMenu(null);
            setIsTrimming(true);
            await new Promise(resolve => setTimeout(resolve, 50));
            await store.trimAudioInPlace('end');
            setIsTrimming(false);
          }}>
            Trim after playhead
          </EditorContextMenuItem>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
          <EditorContextMenuItem danger onClick={() => {
            setContextMenu(null);
            store.removeAudio();
          }}>
            Remove Audio
          </EditorContextMenuItem>
        </EditorContextMenu>
      )}

      {isTrimming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', backdropFilter: 'blur(10px)' }}>
          <div className="loader" style={{ width: 64, height: 64, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ marginTop: 24, fontSize: 28, fontWeight: 'bold' }}>Trimming Audio...</h2>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};
