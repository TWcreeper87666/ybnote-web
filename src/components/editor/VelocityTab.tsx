import React, { useRef, useEffect, useState } from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';

export const VelocityTab: React.FC = () => {
  const store = useLevelEditorStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);

  // --- Rendering ---
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const zoom = store.zoomLevel;

    ctx.clearRect(0, 0, width, height);

    // Grid line (horizontal at 50%)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const track = store.getCurrentTrack();
    if (track) {
      track.notes.forEach(note => {
        const isSelected = store.selectedNoteIds.has(note.id);
        const x = note.timeStart * zoom;
        const w = Math.max(note.duration * zoom, 4);

        const velocityH = note.velocity * height;
        const y = height - velocityH;

        ctx.fillStyle = isSelected ? '#ff5555' : '#888';

        // Stalk
        ctx.fillRect(x + w / 2 - 1, y, 2, velocityH);
        // Head
        ctx.beginPath();
        ctx.arc(x + w / 2, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };

  useEffect(() => {
    drawCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.zoomLevel, store.selectedTrackId, store.midiData, store.selectedNoteIds, store.getCurrentTrack()?.notes, store.scrollLeft]);

  // --- Resizing ---
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const trackDuration = store.midiData?.duration || 0;
    const totalDuration = Math.max(trackDuration, 60);

    const minWidth = wrapper.clientWidth;
    const requiredWidth = totalDuration * store.zoomLevel;

    canvas.width = Math.max(minWidth, requiredWidth);
    canvas.height = wrapper.clientHeight;
    drawCanvas();
  };

  useEffect(() => {
    const observer = new ResizeObserver(() => resizeCanvas());
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }
    resizeCanvas();
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    resizeCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.zoomLevel, store.midiData?.duration]);

  // --- Interaction ---
  const handleVelocityDrag = (e: MouseEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const track = store.getCurrentTrack();
    if (!track) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const zoom = store.zoomLevel;
    const newVelocity = Math.max(0, Math.min(1, 1 - (y / canvas.height)));

    const updates: { id: string; changes: { velocity: number } }[] = [];

    let hitSelected = false;
    const searchThreshold = 6; // pixels

    // Find if we hit a selected note
    track.notes.forEach(note => {
      const nx = note.timeStart * zoom + Math.max(note.duration * zoom, 4) / 2;
      if (Math.abs(x - nx) < searchThreshold) {
        if (store.selectedNoteIds.size > 0 && store.selectedNoteIds.has(note.id)) {
          hitSelected = true;
        } else if (store.selectedNoteIds.size === 0) {
          updates.push({ id: note.id, changes: { velocity: newVelocity } });
        }
      }
    });

    if (hitSelected) {
      track.notes.forEach(note => {
        if (store.selectedNoteIds.has(note.id)) {
          updates.push({ id: note.id, changes: { velocity: newVelocity } });
        }
      });
    }

    if (updates.length > 0) {
      store.updateNotes(updates, false); // don't commit history during drag
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleVelocityDrag(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    store.commitHistory(); // commit history when drag ends
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    // Call drag once immediately
    if (!isDragging) {
      setIsDragging(true);
      setTimeout(() => handleVelocityDrag(e), 0);
    }
  };

  if (!store.showVelocityTab) return null;

  return (
    <div className="le-velocity-wrapper" ref={wrapperRef}>
      <div 
        className="le-velocity-container" 
        style={{ transform: `translateX(${-store.scrollLeft}px)` }}
      >
        <canvas 
          ref={canvasRef} 
          onMouseDown={handleMouseDown}
          className="le-velocity-canvas"
        />
      </div>
    </div>
  );
};
