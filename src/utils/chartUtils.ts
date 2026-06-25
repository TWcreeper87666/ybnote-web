import type { Block, EditorNote, EditorTrack, ParsedMidiData } from '../types';
import { useStore } from '../store/useStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';

export const BLOCK_SIZE = 60;

export interface RecordedHit {
  time: number;
  blockId: string;
  blockType: 'block' | 'groupRect';
}

export type AutoChartStrategy = 'nearest' | 'roundRobin' | 'random';

export interface AutoChartOptions {
  cdRadius: number;
  strategy: AutoChartStrategy;
  onlyUnassigned: boolean;
  cdDuration?: number;
}

export interface GenerateBlocksResult {
  addedBlocks: number;
  addedGroupRects: number;
}

export interface MatchResult {
  matched: { noteId: string; trackId: number; hit: RecordedHit }[];
  unmatchedNotes: { noteId: string; trackId: number; time: number; name: string }[];
  extraHits: RecordedHit[];
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function blockDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const ax = a.x + BLOCK_SIZE / 2;
  const ay = a.y + BLOCK_SIZE / 2;
  const bx = b.x + BLOCK_SIZE / 2;
  const by = b.y + BLOCK_SIZE / 2;
  return Math.hypot(ax - bx, ay - by);
}

export function setEditorBlocks(blocks: Block[]) {
  useLevelEditorStore.getState().setGameBlocks(blocks);
}

export function syncGameBlocksToCanvas() {
  // no-op: EditorCanvas reads directly from useLevelEditorStore.gameBlocks
}

export function syncCanvasToGameBlocks() {
  // no-op: EditorCanvas reads directly from useLevelEditorStore.gameBlocks
}

export function buildGameEventsFromMidi(midiData: ParsedMidiData) {
  const events: { time: number; pitch: string; instrument: string; blockId: string }[] = [];

  for (const track of midiData.tracks) {
    if (track.isBackground) {
      for (const note of track.notes) {
        events.push({
          time: note.timeStart * 1000,
          pitch: note.name,
          instrument: track.instrument,
          blockId: 'background',
        });
      }
    } else {
      for (const note of track.notes) {
        if (note.targetId) {
          events.push({
            time: note.timeStart * 1000,
            pitch: note.name,
            instrument: track.instrument,
            blockId: note.targetId,
          });
        }
      }
    }
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

export function syncGameEventsFromMidi(midiData: ParsedMidiData | null) {
  if (!midiData) return;
  useLevelEditorStore.getState().setGameEvents(buildGameEventsFromMidi(midiData));
}

export function getAllChartNotes(midiData: ParsedMidiData) {
  const notes: { note: EditorNote; track: EditorTrack }[] = [];
  for (const track of midiData.tracks) {
    if (track.isBackground) continue;
    for (const note of track.notes) {
      notes.push({ note, track });
    }
  }
  notes.sort((a, b) => a.note.timeStart - b.note.timeStart);
  return notes;
}

export type ChartCandidate = {
  id: string;
  x: number;
  y: number;
  pitch: string;
  instrument: string;
  type: 'block' | 'groupRect';
};

export function getCandidateBlocks(note: EditorNote, track: EditorTrack): ChartCandidate[] {
  const mainState = useStore.getState();
  const editorState = useLevelEditorStore.getState();
  if (track.instrument === 'group_rect') {
    return mainState.groupRects.map((g) => ({
      id: g.id,
      x: g.x + g.w / 2 - BLOCK_SIZE / 2,
      y: g.y + g.h / 2 - BLOCK_SIZE / 2,
      pitch: note.name,
      instrument: track.instrument,
      type: 'groupRect' as const,
    }));
  }
  return editorState.gameBlocks
    .filter((b) => b.pitch === note.name && b.instrument === track.instrument)
    .map((b) => ({ ...b, type: 'block' as const }));
}

export function generateMissingBlocks(midiData: ParsedMidiData): GenerateBlocksResult {
  const main = useStore.getState();
  const editorStore = useLevelEditorStore.getState();
  const currentBlocks = [...editorStore.gameBlocks];
  const groupRects = [...main.groupRects];
  let addedBlocks = 0;
  let addedGroupRects = 0;

  const uniqueKeys = new Map<string, { pitch: string; instrument: string; isGroupRect: boolean }>();

  for (const track of midiData.tracks) {
    if (track.isBackground) continue;
    const isGroupRect = track.instrument === 'group_rect';
    for (const note of track.notes) {
      const key = `${note.name}-${track.instrument}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.set(key, { pitch: note.name, instrument: track.instrument, isGroupRect });
      }
    }
  }

  const cols = 8;
  let i = currentBlocks.length + groupRects.length;
  const camera = main.camera;
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
  const localCenterX = (centerX - camera.x) / camera.zoom;
  const startX = localCenterX - (cols * 80) / 2;
  const localStartY = (100 - camera.y) / camera.zoom;

  for (const [, info] of uniqueKeys) {
    if (info.isGroupRect) {
      const exists = groupRects.some((g) => g.name === info.pitch);
      if (!exists) {
        const id = main.addGroupRect({
          x: startX + (i % cols) * 80,
          y: localStartY + Math.floor(i / cols) * 80,
          w: 120,
          h: 120,
          name: info.pitch,
          volume: 1,
        });
        groupRects.push({ id, name: info.pitch, x: 0, y: 0, w: 120, h: 120 });
        addedGroupRects++;
        i++;
      }
    } else {
      const exists = currentBlocks.some(
        (b) => b.pitch === info.pitch && b.instrument === info.instrument,
      );
      if (!exists) {
        const id = generateId();
        currentBlocks.push({
          id,
          x: startX + (i % cols) * 80,
          y: localStartY + Math.floor(i / cols) * 80,
          pitch: info.pitch,
          instrument: info.instrument,
          volume: 1,
        });
        addedBlocks++;
        i++;
      }
    }
  }

  if (addedBlocks > 0) {
    useLevelEditorStore.getState().setGameBlocks(currentBlocks);
  }

  return { addedBlocks, addedGroupRects };
}

function pickBlock<T extends { id: string; x: number; y: number }>(
  candidates: T[],
  strategy: AutoChartStrategy,
  lastTriggered: T | null,
  roundRobinIndex: number,
): { chosen: T; nextRoundRobinIndex: number } {
  if (candidates.length === 0) {
    throw new Error('No candidates');
  }
  if (!lastTriggered) {
    return { chosen: candidates[0], nextRoundRobinIndex: roundRobinIndex };
  }
  if (strategy === 'roundRobin') {
    const idx = roundRobinIndex % candidates.length;
    return { chosen: candidates[idx], nextRoundRobinIndex: roundRobinIndex + 1 };
  }
  if (strategy === 'random') {
    return {
      chosen: candidates[Math.floor(Math.random() * candidates.length)],
      nextRoundRobinIndex: roundRobinIndex,
    };
  }
  const sorted = [...candidates].sort(
    (a, b) => blockDistance(a, lastTriggered) - blockDistance(b, lastTriggered),
  );
  return { chosen: sorted[0], nextRoundRobinIndex: roundRobinIndex };
}

export function autoChart(midiData: ParsedMidiData, options: AutoChartOptions): ParsedMidiData {
  const cdRadiusPx = options.cdRadius * BLOCK_SIZE;
  const cdDuration = options.cdDuration ?? 0.15;
  const tracks = JSON.parse(JSON.stringify(midiData.tracks)) as EditorTrack[];

  const allNotes: { note: EditorNote; track: EditorTrack }[] = [];
  for (const track of tracks) {
    if (track.isBackground) continue;
    for (const note of track.notes) {
      allNotes.push({ note, track });
    }
  }
  allNotes.sort((a, b) => a.note.timeStart - b.note.timeStart);

  let lastTriggered: ChartCandidate | null = null;
  const cdMap: Record<string, number> = {};
  let roundRobinIndex = 0;

  for (const { note, track } of allNotes) {
    if (options.onlyUnassigned && note.targetId) continue;

    const candidates = getCandidateBlocks(note, track);
    if (candidates.length === 0) continue;

    let activeCandidates = candidates.filter(
      (b) => cdMap[b.id] == null || note.timeStart > cdMap[b.id],
    );
    if (activeCandidates.length === 0) activeCandidates = candidates;

    const pickResult = pickBlock<ChartCandidate>(
      activeCandidates,
      options.strategy,
      lastTriggered,
      roundRobinIndex,
    );
    const chosen: ChartCandidate = pickResult.chosen;
    roundRobinIndex = pickResult.nextRoundRobinIndex;

    note.targetId = chosen.id;
    note.targetType = chosen.type;
    lastTriggered = chosen;

    for (const b of candidates) {
      if (blockDistance(b, chosen) <= cdRadiusPx) {
        cdMap[b.id] = note.timeStart + cdDuration;
      }
    }
  }

  return { ...midiData, tracks };
}

export function matchRecordedHits(
  midiData: ParsedMidiData,
  hits: RecordedHit[],
  toleranceMs = 200,
  timeRange?: { start: number; end: number },
): MatchResult {
  const allNotes = getAllChartNotes(midiData);
  const usedNoteIds = new Set<string>();
  const matched: MatchResult['matched'] = [];
  const extraHits: RecordedHit[] = [];

  const sortedHits = [...hits].sort((a, b) => a.time - b.time);

  for (const hit of sortedHits) {
    if (timeRange && (hit.time < timeRange.start * 1000 || hit.time > timeRange.end * 1000)) {
      extraHits.push(hit);
      continue;
    }

    let hitPitch: string | null;
    if (hit.blockType === 'block') {
      const block = useLevelEditorStore.getState().gameBlocks.find((b) => b.id === hit.blockId)
        ?? useStore.getState().blocks.find((b) => b.id === hit.blockId);
      hitPitch = block?.pitch ?? null;
    } else {
      const gr = useStore.getState().groupRects.find((g) => g.id === hit.blockId);
      hitPitch = gr?.name ?? null;
    }

    if (!hitPitch) {
      extraHits.push(hit);
      continue;
    }

    let best: { note: EditorNote; track: EditorTrack; diff: number } | null = null;

    for (const { note, track } of allNotes) {
      if (usedNoteIds.has(note.id)) continue;
      if (note.name !== hitPitch) continue;
      if (timeRange) {
        if (note.timeStart < timeRange.start || note.timeStart > timeRange.end) continue;
      }
      const diff = Math.abs(hit.time - note.timeStart * 1000);
      if (diff < toleranceMs && (!best || diff < best.diff)) {
        best = { note, track, diff };
      }
    }

    if (best) {
      usedNoteIds.add(best.note.id);
      matched.push({ noteId: best.note.id, trackId: best.track.id, hit });
    } else {
      extraHits.push(hit);
    }
  }

  const unmatchedNotes = allNotes
    .filter(({ note }) => !usedNoteIds.has(note.id) && !note.targetId)
    .map(({ note, track }) => ({
      noteId: note.id,
      trackId: track.id,
      time: note.timeStart,
      name: note.name,
    }));

  return { matched, unmatchedNotes, extraHits };
}

export function applyMatchResult(
  midiData: ParsedMidiData,
  matched: MatchResult['matched'],
  overwrite = true,
): ParsedMidiData {
  const tracks = JSON.parse(JSON.stringify(midiData.tracks)) as EditorTrack[];
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  for (const m of matched) {
    const track = trackMap.get(m.trackId);
    if (!track) continue;
    const note = track.notes.find((n) => n.id === m.noteId);
    if (!note) continue;
    if (!overwrite && note.targetId) continue;
    note.targetId = m.hit.blockId;
    note.targetType = m.hit.blockType;
  }

  return { ...midiData, tracks };
}

export function getAssignmentCounts(midiData: ParsedMidiData | null) {
  const counts = new Map<string, number>();
  if (!midiData) return counts;
  for (const track of midiData.tracks) {
    if (track.isBackground) continue;
    for (const note of track.notes) {
      if (note.targetId) {
        counts.set(note.targetId, (counts.get(note.targetId) ?? 0) + 1);
      }
    }
  }
  return counts;
}
