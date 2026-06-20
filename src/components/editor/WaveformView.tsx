import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.js';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';

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

  useEffect(() => {
    if (!containerRef.current || !store.audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a5b4fc',
      progressColor: '#4f46e5',
      cursorColor: '#ff5555',
      cursorWidth: 2,
      minPxPerSec: store.zoomLevel,
      autoCenter: false,
      interact: false, // We handle click/drag manually
      hideScrollbar: true,
      height: 'auto'
    });

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
  }, [store.audioUrl]);

  // Sync volume & playback rate from store
  useEffect(() => {
    if (wavesurferRef.current) wavesurferRef.current.setVolume(store.audioVolume / 100);
  }, [store.audioVolume]);

  useEffect(() => {
    if (wavesurferRef.current) {
      const oldRate = wavesurferRef.current.getPlaybackRate();
      const newRate = store.audioPlaybackRate;
      wavesurferRef.current.setPlaybackRate(newRate);
      
      const currentAudioTime = (store.playbackAnchor - store.audioStartTime) * oldRate;
      store.setAudioStartTime(store.playbackAnchor - (currentAudioTime / newRate));
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
      const targetAudioTime = (store.playbackPosition - store.audioStartTime) * store.audioPlaybackRate;
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
      const targetAudioTime = (store.playbackAnchor - store.audioStartTime) * store.audioPlaybackRate;
      if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        ws.setTime(targetAudioTime);
      } else {
        ws.setTime(0);
      }
    }
  }, [store.isPlaying, store.playbackPosition, store.playbackAnchor, store.audioStartTime, store.audioPlaybackRate, isLoaded, audioDuration]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle click panning
      e.preventDefault();
      isMiddlePanning.current = true;
      panStartMouseX.current = e.clientX;
      panStartScrollX.current = store.scrollLeft;
      document.body.style.cursor = 'grabbing';
      
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      return;
    }

    if (!store.audioUrl) return;
    const target = e.target as HTMLElement;
    if (target.closest('.rate-selector')) return;
    
    setIsDragging(false);
    dragStartX.current = e.clientX;
    dragStartAudioTime.current = store.audioStartTime;
    clickStart.current = Date.now();
    
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleWindowMouseMove = (e: MouseEvent) => {
    if (isMiddlePanning.current) {
      const dx = e.clientX - panStartMouseX.current;
      store.setScrollLeft(panStartScrollX.current - dx);
      return;
    }

    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 3) {
      setIsDragging(true);
      const dt = dx / store.zoomLevel;
      store.setAudioStartTime(dragStartAudioTime.current + dt);
      
      if (wavesurferRef.current && !useLevelEditorStore.getState().isPlaying) {
        const targetAudioTime = (store.playbackAnchor - store.audioStartTime) * store.audioPlaybackRate;
        wavesurferRef.current.setTime(Math.max(0, targetAudioTime));
      }
    }
  };

  const handleWindowMouseUp = (e: MouseEvent) => {
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    
    if (isMiddlePanning.current) {
      isMiddlePanning.current = false;
      document.body.style.cursor = '';
      return;
    }

    if (!isDragging && Date.now() - clickStart.current < 300) {
      // Treat as click for seeking
      if (wrapperRef.current && wavesurferRef.current) {
        const contentEl = wrapperRef.current.querySelector('.waveform-content');
        if (contentEl) {
          const rect = contentEl.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickedTime = Math.max(0, clickX / store.zoomLevel);
          store.setPlaybackAnchor(clickedTime);
        }
      }
    }
    setIsDragging(false);
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

  const currentTotalSeconds = Math.max(0, (store.playbackAnchor - store.audioStartTime) * store.audioPlaybackRate);
  const m = Math.floor(currentTotalSeconds / 60);
  const s = Math.floor(currentTotalSeconds % 60);
  const dragTimeText = `${m}:${s.toString().padStart(2, '0')}`;

  const offsetPixels = store.audioStartTime * store.zoomLevel;
  const scaledDuration = (audioDuration * store.zoomLevel) / store.audioPlaybackRate;

  return (
    <div 
      className="waveform-wrapper" 
      ref={wrapperRef}
      onMouseDown={handleMouseDown}
    >
      {isDragging && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 100, background: 'rgba(30,30,38,0.9)', border: '1px solid #4a90e2',
          borderRadius: 8, padding: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 200, pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffcc00' }}>{dragTimeText}</div>
          <div ref={minimapRef} style={{ width: '100%', height: 20, background: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' }} />
        </div>
      )}

      <div className="rate-selector" style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}>
        <select 
          value={store.audioPlaybackRate} 
          onChange={(e) => store.setAudioPlaybackRate(Number(e.target.value))}
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}
        >
          <option value={0.5}>0.5x</option>
          <option value={0.75}>0.75x</option>
          <option value={1.0}>1.0x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
        </select>
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
        </div>
      </div>
    </div>
  );
};
