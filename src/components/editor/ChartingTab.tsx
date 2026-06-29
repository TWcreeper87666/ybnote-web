import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { useStore } from '../../store/useStore';
import { getAllChartNotes, getCandidateBlocks, blockDistance } from '../../utils/chartUtils';
import { playNote } from '../../utils/audio';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 4,
};

export const ChartingTab: React.FC = () => {
  const store = useLevelEditorStore();
  const playbackRafRef = useRef(0);
  const lastRafTimeRef = useRef(0);

  const editorBlocks = useLevelEditorStore(s => s.blocks);

  // Non-background tracks available for per-track charting
  const availableTracks = useMemo(
    () => store.midiData?.tracks.filter(t => !t.isBackground) ?? [],
    [store.midiData],
  );

  // Auto-select first track when nothing is selected (e.g. on first load)
  useEffect(() => {
    const es = useLevelEditorStore.getState();
    if (es.selectedMidiTrackId === null && availableTracks.length > 0) {
      es.selectMidiTrack(availableTracks[0].id);
    }
  }, [availableTracks]);

  // Clear stale highlight state when midiData changes (covers undo/redo + track deletion)
  // Skip if actively assigning — assignNoteTarget changes midiData and must not disrupt the flow
  useEffect(() => {
    if (useLevelEditorStore.getState().chartingAwaitingPick) return;
    useLevelEditorStore.setState({
      chartingHighlightIds: [],
      chartingAssignedHighlightId: null,
      chartingAwaitingPick: false,
    });
  }, [store.midiData]);

  const chartNotes = useMemo(() => {
    if (!store.midiData || store.selectedMidiTrackId === null) return [];
    return getAllChartNotes(store.midiData).filter(
      e => e.track.id === store.selectedMidiTrackId
    );
  }, [store.midiData, store.selectedMidiTrackId]);

  const currentEntry = chartNotes[store.chartingNoteIndex] ?? null;

  // Per-note state for the progress bar: 'assigned' | 'unassigned' | 'missing'
  const noteStates = useMemo(() => {
    const blockSet = new Set(editorBlocks.map(b => `${b.pitch}-${b.instrument || 'piano'}`));
    const blockIds = new Set(editorBlocks.map(b => b.id));
    return chartNotes.map(e => {
      const { note } = e;
      if (note.targetId) {
        return blockIds.has(note.targetId) ? 'assigned' : 'missing';
      }
      return blockSet.has(`${note.name}-${e.track.instrument}`) ? 'unassigned' : 'missing';
    });
  }, [chartNotes, editorBlocks]);

  const assignedCount = useMemo(
    () => noteStates.filter(s => s === 'assigned').length,
    [noteStates],
  );
  const pct = chartNotes.length > 0 ? Math.round((assignedCount / chartNotes.length) * 100) : 0;
  const unassignedCount = chartNotes.length - assignedCount;

  const currentCandidates = useMemo(() => {
    if (!currentEntry) return [];
    return getCandidateBlocks(currentEntry.note, currentEntry.track);
  }, [currentEntry]);

  const pauseForNote = useCallback((index: number) => {
    const entry = chartNotes[index];
    if (!entry) return;
    const es = useLevelEditorStore.getState();
    // Anchor to the note's time so stopPlayback (and any subsequent resume) starts from here
    es.setPlaybackAnchor(entry.note.timeStart);
    es.stopPlayback();
    es.setChartingNoteIndex(index);
    es.setChartingPaused(true);

    const candidates = getCandidateBlocks(entry.note, entry.track);
    const candidateIds = candidates.map(c => c.id);
    es.setChartingHighlightIds(candidateIds);
    // Only show assigned highlight if the block is a valid candidate (matching pitch+instrument).
    // An assigned block with wrong pitch (stale data from old bug) must NOT show green —
    // it would confuse the user into thinking the wrong block is correct.
    es.setChartingAssignedHighlightId(
      entry.note.targetId && candidateIds.includes(entry.note.targetId)
        ? entry.note.targetId
        : null
    );

    let lastPos: { x: number; y: number } | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const prev = chartNotes[i];
      if (prev?.note.targetId) {
        const blk = useLevelEditorStore.getState().blocks.find(b => b.id === prev.note.targetId)
          ?? useStore.getState().blocks.find(b => b.id === prev.note.targetId);
        if (blk) { lastPos = blk; break; }
      }
    }
    const weights: Record<string, number> = {};
    if (lastPos && candidates.length > 0) {
      const distances = candidates.map(c => blockDistance(c, lastPos!));
      const maxDist = Math.max(...distances, 1);
      candidates.forEach((c, i) => { weights[c.id] = 1 - distances[i] / maxDist; });
    } else {
      candidates.forEach(c => { weights[c.id] = 1; });
    }
    es.setChartingHighlightWeights(weights);

    es.setChartingAwaitingPick(true);
  }, [chartNotes]);

  // ── Playback loop ────────────────────────────────────────────────────────────
  const chartingPlaybackLoop = useCallback(function loop(time: DOMHighResTimeStamp) {
    const s = useLevelEditorStore.getState();
    if (!s.isPlaying || s.isRecordingChart) return;

    if (!lastRafTimeRef.current) lastRafTimeRef.current = time;
    const dt = (time - lastRafTimeRef.current) / 1000;
    lastRafTimeRef.current = time;

    const newPos = s.playbackPosition + dt * s.audioPlaybackRate;
    if (newPos >= s.chartEndPosition) { s.stopPlayback(); return; }

    if (s.midiData) {
      for (const { note, track } of chartNotes) {
        const newMs = newPos * 1000;
        const oldMs = s.playbackPosition * 1000;
        // Use strict > so resuming from a note's exact time won't re-trigger it
        if (note.timeStart * 1000 > oldMs && note.timeStart * 1000 <= newMs) {
          playNote(note.name, note.velocity * (s.midiVolume / 100), track.instrument);

          // Always flash the assigned block for visual feedback
          if (note.targetId) {
            const main = useStore.getState();
            if (note.targetType === 'groupRect') {
              main.updateGroupRect(note.targetId, { playedAt: Date.now() });
            } else {
              main.updateBlock(note.targetId, { playedAt: Date.now() });
              useLevelEditorStore.getState().updateBlock(note.targetId, { playedAt: Date.now() });
            }
          }

          // Mode-based pause logic
          const mode = s.chartingPlaybackMode;
          const shouldPause =
            mode === 'note-by-note' ||
            (mode === 'skip-assigned' && !note.targetId);

          if (shouldPause) {
            const idx = chartNotes.findIndex(e => e.note.id === note.id);
            if (idx >= 0) {
              pauseForNote(idx);
              return; // stop the loop — don't update position or schedule next frame
            }
          }
        }
      }
    }

    useLevelEditorStore.setState({ playbackPosition: newPos });
    playbackRafRef.current = requestAnimationFrame(loop);
  }, [chartNotes, pauseForNote]);

  useEffect(() => {
    if (store.activeTab !== 'charting') return;
    if (store.isPlaying && !store.isRecordingChart) {
      lastRafTimeRef.current = 0;
      playbackRafRef.current = requestAnimationFrame(chartingPlaybackLoop);
    }
    return () => cancelAnimationFrame(playbackRafRef.current);
  }, [store.isPlaying, store.isRecordingChart, store.activeTab, chartingPlaybackLoop]);


  // ── Navigation ───────────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    const idx = Math.max(0, store.chartingNoteIndex - 1);
    store.setPlaybackAnchor(chartNotes[idx]?.note.timeStart ?? 0);
    pauseForNote(idx);
  }, [store, chartNotes, pauseForNote]);

  const handleNext = useCallback(() => {
    const idx = Math.min(chartNotes.length - 1, store.chartingNoteIndex + 1);
    store.setPlaybackAnchor(chartNotes[idx]?.note.timeStart ?? 0);
    pauseForNote(idx);
  }, [store, chartNotes, pauseForNote]);

  const handleJumpToNextUnassigned = useCallback(() => {
    let idx = chartNotes.findIndex((e, i) => i > store.chartingNoteIndex && !e.note.targetId);
    if (idx < 0) idx = chartNotes.findIndex(e => !e.note.targetId);
    if (idx >= 0) {
      store.setPlaybackAnchor(chartNotes[idx].note.timeStart);
      pauseForNote(idx);
    }
  }, [chartNotes, store, pauseForNote]);

  // Skip current note: just advance to the next one
  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  // Keyboard shortcuts
  useEffect(() => {
    if (store.activeTab !== 'charting') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (useLevelEditorStore.getState().activeTab !== 'charting') return;

      if (e.key === ' ') {
        e.preventDefault();
        useLevelEditorStore.getState().togglePlayback();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'n' || e.key === 'u') {
        e.preventDefault();
        handleJumpToNextUnassigned();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        useLevelEditorStore.getState().stopPlayback();
        useLevelEditorStore.getState().setChartingAwaitingPick(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store.activeTab, handlePrev, handleNext, handleJumpToNextUnassigned]);

  // Progress bar click
  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (chartNotes.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.min(chartNotes.length - 1, Math.floor(ratio * chartNotes.length));
    store.setPlaybackAnchor(chartNotes[idx].note.timeStart);
    pauseForNote(idx);
  }, [chartNotes, store, pauseForNote]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,0.97), rgba(0,0,0,0.7), transparent)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
    }}>

      {/* ── Progress bar ──────────────────────────────────────────────────────── */}
      {chartNotes.length > 0 && (
        <div
          onClick={handleProgressBarClick}
          title="Click to jump to a note"
          style={{
            position: 'relative',
            height: 20,
            background: '#111',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'row',
            flexShrink: 0,
            gap: 1,
            padding: '3px 0',
            boxSizing: 'border-box',
          }}
        >
          {chartNotes.map((entry, i) => {
            const isCurrent = i === store.chartingNoteIndex;
            const state = noteStates[i];
            const stateColor = state === 'assigned' ? '#4ade80'
              : state === 'unassigned' ? '#f97316'
              : '#ef4444';
            return (
              <div
                key={entry.note.id}
                style={{
                  flex: 1,
                  minWidth: 1,
                  background: stateColor,
                  opacity: isCurrent ? 1 : 0.55,
                  borderRadius: 1,
                }}
              />
            );
          })}
        </div>
      )}

      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Awaiting-pick callout */}
        {store.chartingAwaitingPick && currentEntry && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: currentCandidates.length === 0
              ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.18)',
            border: `1px solid ${currentCandidates.length === 0 ? '#ef4444' : '#6366f1'}`,
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
              color: currentCandidates.length === 0 ? '#f87171' : '#a5b4fc' }}>
              {currentCandidates.length === 0 ? 'No Block' : 'Assign'}
            </span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{currentEntry.note.name}</span>
            <span style={{ color: '#64748b' }}>·</span>
            <span style={{ color: '#c4b5fd' }}>{currentEntry.track.instrument}</span>
            {currentCandidates.length > 0
              ? <span style={{ color: '#94a3b8', fontSize: 12 }}>{currentCandidates.length} candidate{currentCandidates.length !== 1 ? 's' : ''} highlighted — click one</span>
              : <span style={{ color: '#f97316', fontSize: 12 }}>No matching block on canvas</span>}
            {currentCandidates.length === 0 && (
              <button
                onClick={() => {
                  const es = useLevelEditorStore.getState();
                  const cam = es.camera ?? { x: 0, y: 0, zoom: 1 };
                  const cx = -cam.x / cam.zoom + 400;
                  const cy = -cam.y / cam.zoom + 300;
                  es.addBlock({ pitch: currentEntry.note.name, instrument: currentEntry.track.instrument, volume: 1, x: cx - 30, y: cy - 30 });
                  pauseForNote(store.chartingNoteIndex);
                }}
                style={{ background: '#6366f1', border: 'none', color: '#fff', padding: '3px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}
              >
                + Place on canvas
              </button>
            )}
            <button onClick={handleSkip}
              style={{ marginLeft: currentCandidates.length === 0 ? '0' : 'auto', background: 'transparent', border: '1px solid #555', color: '#9ca3af', padding: '3px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
              Skip
            </button>
          </div>
        )}

        {/* Assigned note info (when not awaiting pick but on an assigned note) */}
        {!store.chartingAwaitingPick && currentEntry?.note.targetId && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
          }}>
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Assigned</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{currentEntry.note.name}</span>
            <span style={{ color: '#64748b' }}>·</span>
            <span style={{ color: '#c4b5fd' }}>{currentEntry.track.instrument}</span>
            {currentCandidates.length > 1
              ? <span style={{ color: '#94a3b8', fontSize: 11 }}>→ click another highlighted block to reassign</span>
              : <span style={{ color: '#4ade80', fontSize: 11 }}>→ assigned block highlighted in green</span>}
          </div>
        )}

        {/* Transport row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={handlePrev} style={iconBtn} title="Previous note (←)"><ChevronLeft size={20} /></button>
          <button onClick={() => store.togglePlayback()} style={iconBtn} title="Play / Pause (Space)">
            {store.isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button onClick={handleNext} style={iconBtn} title="Next note (→)"><ChevronRight size={20} /></button>

          <div style={{ width: 1, height: 18, background: '#333', margin: '0 4px', flexShrink: 0 }} />

          <button
            onClick={handleJumpToNextUnassigned}
            disabled={unassignedCount === 0}
            style={{
              ...iconBtn,
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12,
              color: unassignedCount > 0 ? '#f97316' : '#3f4454',
              padding: '3px 8px',
              border: `1px solid ${unassignedCount > 0 ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
              borderRadius: 5,
              cursor: unassignedCount > 0 ? 'pointer' : 'default',
            }}
            title="Jump to next unassigned note (N)"
          >
            <SkipForward size={13} />
            {unassignedCount > 0 ? `${unassignedCount} unassigned` : 'All assigned!'}
          </button>

          {currentEntry && !store.chartingAwaitingPick && !currentEntry.note.targetId && (
            <span style={{ color: '#f97316', fontSize: 12, marginLeft: 2 }}>
              {currentEntry.note.name} · {currentEntry.track.instrument} · {formatTime(currentEntry.note.timeStart)}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? '#4ade80' : pct > 0 ? '#f97316' : '#6b7280' }}>
              {assignedCount}/{chartNotes.length}
              {chartNotes.length > 0 && <span style={{ fontWeight: 400, opacity: 0.8 }}> ({pct}%)</span>}
            </span>
            <span style={{ color: '#374151', fontSize: 11 }}>·</span>
            <span style={{ color: '#6b7280', fontSize: 12 }}>{formatTime(store.playbackPosition)}</span>
          </div>
        </div>

        {/* Options row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Step-by-step toggle */}
          <button
            onClick={() => store.setChartingPlaybackMode(
              store.chartingPlaybackMode === 'note-by-note' ? 'normal' : 'note-by-note'
            )}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: store.chartingPlaybackMode === 'note-by-note' ? 'rgba(99,102,241,0.25)' : 'transparent',
              border: `1px solid ${store.chartingPlaybackMode === 'note-by-note' ? '#6366f1' : '#374151'}`,
              color: store.chartingPlaybackMode === 'note-by-note' ? '#a5b4fc' : '#4b5563',
              padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
            }}
            title="Step-by-step: pause at every note"
          >
            Step-by-step
          </button>


          <span style={{ marginLeft: 'auto', color: '#374151', fontSize: 10, userSelect: 'none' }}>
            Space·play  ←→·nav  N·next unassigned  Esc·stop
          </span>
        </div>
      </div>
    </div>
  );
};
