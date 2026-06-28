import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Circle, Square } from 'lucide-react';
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

export const ChartingTab: React.FC = () => {
  const store = useLevelEditorStore();
  const lastTriggeredRef = useRef<string | null>(null);
  const playbackRafRef = useRef(0);
  const lastRafTimeRef = useRef(0);

  const chartNotes = useMemo(
    () => (store.midiData ? getAllChartNotes(store.midiData) : []),
    [store.midiData],
  );

  const currentEntry = chartNotes[store.chartingNoteIndex] ?? null;

  const pauseForNote = useCallback((index: number) => {
    const entry = chartNotes[index];
    if (!entry) return;
    store.stopPlayback();
    store.setChartingNoteIndex(index);
    store.setChartingPaused(true);
    const candidates = getCandidateBlocks(entry.note, entry.track);
    store.setChartingHighlightIds(candidates.map((c) => c.id));

    // Find the last assigned block before this note to compute proximity weights
    let lastPos: { x: number; y: number } | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const prev = chartNotes[i];
      if (prev?.note.targetId) {
        const editorBlocks = useLevelEditorStore.getState().blocks;
        const blk = editorBlocks.find((b) => b.id === prev.note.targetId)
          ?? useStore.getState().blocks.find((b) => b.id === prev.note.targetId);
        if (blk) { lastPos = blk; break; }
      }
    }

    const weights: Record<string, number> = {};
    if (lastPos && candidates.length > 0) {
      const distances = candidates.map((c) => blockDistance(c, lastPos!));
      const maxDist = Math.max(...distances, 1);
      candidates.forEach((c, i) => { weights[c.id] = 1 - distances[i] / maxDist; });
    } else {
      candidates.forEach((c) => { weights[c.id] = 1; });
    }
    store.setChartingHighlightWeights(weights);

    if (!entry.note.targetId) {
      store.setChartingAwaitingPick(true);
    }
  }, [chartNotes, store]);

  const advanceCharting = useCallback(() => {
    const nextIndex = store.chartingNoteIndex + 1;
    if (nextIndex >= chartNotes.length) {
      store.setChartingAwaitingPick(false);
      store.setChartingHighlightIds([]);
      return;
    }
    store.setChartingNoteIndex(nextIndex);
    const entry = chartNotes[nextIndex];
    if (!entry) return;

    if (entry.note.targetId && store.chartingAutoSkipAssigned) {
      const main = useStore.getState();
      if (entry.note.targetType === 'groupRect') {
        main.updateGroupRect(entry.note.targetId, { playedAt: Date.now() });
      } else {
        main.updateBlock(entry.note.targetId, { playedAt: Date.now() });
        useLevelEditorStore.getState().updateBlock(entry.note.targetId, { playedAt: Date.now() });
      }
      store.setPlaybackAnchor(entry.note.timeStart);
      store.togglePlayback();
    } else if (!entry.note.targetId) {
      pauseForNote(nextIndex);
    }
  }, [chartNotes, pauseForNote, store]);

  const chartingPlaybackLoop = useCallback(function loop(time: DOMHighResTimeStamp) {
    const s = useLevelEditorStore.getState();
    if (!s.isPlaying || s.isRecordingChart) return;

    if (!lastRafTimeRef.current) lastRafTimeRef.current = time;
    const dt = (time - lastRafTimeRef.current) / 1000;
    lastRafTimeRef.current = time;

    const newPos = s.playbackPosition + dt * s.audioPlaybackRate;
    if (newPos >= s.chartEndPosition) {
      s.stopPlayback();
      return;
    }

    if (s.midiData) {
      for (const { note, track } of chartNotes) {
        const newMs = newPos * 1000;
        const oldMs = s.playbackPosition * 1000;
        if (note.timeStart * 1000 >= oldMs && note.timeStart * 1000 < newMs) {
          playNote(note.name, note.velocity * (s.midiVolume / 100), track.instrument);

          if (note.targetId && s.chartingAutoSkipAssigned) {
            const main = useStore.getState();
            if (note.targetType === 'groupRect') {
              main.updateGroupRect(note.targetId, { playedAt: Date.now() });
            } else {
              main.updateBlock(note.targetId, { playedAt: Date.now() });
              useLevelEditorStore.getState().updateBlock(note.targetId, { playedAt: Date.now() });
            }
          } else if (!note.targetId && !s.chartingAwaitingPick) {
            const idx = chartNotes.findIndex((e) => e.note.id === note.id);
            if (idx >= 0) pauseForNote(idx);
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

  useEffect(() => {
    if (store.activeTab !== 'charting' || !store.isRecordingChart) return;
    const interval = setInterval(() => {
      const main = useStore.getState();
      for (const block of main.blocks) {
        if (block.playedAt) {
          const key = `${block.id}-${block.playedAt}`;
          if (lastTriggeredRef.current !== key) {
            lastTriggeredRef.current = key;
            store.recordChartHit(block.id, 'block');
          }
        }
      }
      for (const gr of main.groupRects) {
        if (gr.playedAt) {
          const key = `gr-${gr.id}-${gr.playedAt}`;
          if (lastTriggeredRef.current !== key) {
            lastTriggeredRef.current = key;
            store.recordChartHit(gr.id, 'groupRect');
          }
        }
      }
    }, 16);
    return () => clearInterval(interval);
  }, [store.activeTab, store.isRecordingChart, store]);

  const handlePrev = () => {
    const idx = Math.max(0, store.chartingNoteIndex - 1);
    store.setPlaybackAnchor(chartNotes[idx]?.note.timeStart ?? 0);
    pauseForNote(idx);
  };

  const handleNext = () => {
    const idx = Math.min(chartNotes.length - 1, store.chartingNoteIndex + 1);
    store.setPlaybackAnchor(chartNotes[idx]?.note.timeStart ?? 0);
    pauseForNote(idx);
  };

  const handleReset = () => {
    store.setChartingNoteIndex(0);
    store.setChartingAwaitingPick(false);
    store.setChartingHighlightIds([]);
    store.setPlaybackAnchor(0);
    store.stopPlayback();
  };

  const preview = store.recordMatchPreview;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6), transparent)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'auto',
      }}
    >
      {store.isRecordingChart && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f87171', fontSize: 14, fontWeight: 600 }}>
          <Circle size={14} fill="currentColor" /> Recording... Speed: {store.audioPlaybackRate}x
          <span style={{ color: '#fff', opacity: 0.7, fontWeight: 400 }}>
            Hits: {store.recordedChartHits.length} · {formatTime(store.playbackPosition)}
          </span>
          <button
            onClick={() => { store.stopChartRecording(); store.stopPlayback(); }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
          >
            <Square size={14} fill="currentColor" /> Stop &amp; Match
          </button>
          <button
            onClick={() => { store.discardChartRecording(); store.stopPlayback(); }}
            style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
          >
            Discard
          </button>
        </div>
      )}

      {preview && !store.isRecordingChart && (
        <div style={{ background: 'rgba(30,30,40,0.9)', padding: 12, borderRadius: 8, fontSize: 13 }}>
          <div>成功配對: {preview.matched.length} 個</div>
          <div>未配對音符: {preview.unmatchedNotes.length} 個</div>
          <div>多餘點擊: {preview.extraHits.length} 個</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => store.applyRecordMatch()}
              style={{ background: '#6366f1', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              Apply
            </button>
            <button
              onClick={() => store.discardChartRecording()}
              style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {!store.isRecordingChart && !preview && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handlePrev} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={() => store.togglePlayback()}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              {store.isPlaying ? <Pause size={26} /> : <Play size={26} />}
            </button>
            <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <ChevronRight size={22} />
            </button>

            {currentEntry ? (
              <span style={{ color: '#fff', fontSize: 14 }}>
                {currentEntry.note.name} ({currentEntry.track.instrument}) @ {formatTime(currentEntry.note.timeStart)}
                {currentEntry.note.targetId ? ' ✓' : ' — 點擊方塊分配'}
              </span>
            ) : (
              <span style={{ color: '#9ca3af', fontSize: 14 }}>無音符</span>
            )}

            <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 13 }}>
              {chartNotes.length > 0 ? `${store.chartingNoteIndex + 1}/${chartNotes.length}` : '0/0'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={store.chartingAutoSkipAssigned}
                onChange={(e) => store.setChartingAutoSkipAssigned(e.target.checked)}
              />
              Auto-skip assigned
            </label>

            <button
              onClick={() => {
                store.startChartRecording();
                store.setPlaybackAnchor(store.playbackAnchor);
                store.togglePlayback();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,0.2)', border: '1px solid #dc2626', color: '#fca5a5', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              <Circle size={12} fill="currentColor" /> Record
            </button>

            <button
              onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              <RotateCcw size={14} /> Reset
            </button>

            {store.chartingAwaitingPick && currentEntry && (
              <button
                onClick={() => {
                  if (currentEntry.note.targetId) advanceCharting();
                  else store.togglePlayback();
                }}
                style={{ marginLeft: 'auto', background: '#6366f1', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                {currentEntry.note.targetId ? 'Continue' : 'Skip'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
