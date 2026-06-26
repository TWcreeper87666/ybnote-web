import { create } from 'zustand';
import type { HitEvent, Block, GroupRect, Track } from '../types';
import { INITIAL_CANVAS_STATE, buildCanvasActions } from './createCanvasSlice';
import type { CanvasSliceState, CanvasSliceActions } from './createCanvasSlice';

export type GameEvent = { time: number; pitch: string; instrument: string; blockId: string; };
export type GamePhase = 'upload' | 'arrange' | 'play' | 'paused' | 'result';

interface GameHistorySnapshot {
  blocks: Block[];
  groupRects: GroupRect[];
  tracks: Track[];
}

interface GameSpecificState {
  gameEvents: GameEvent[];
  gamePhase: GamePhase;
  gameScore: number;
  gameCombo: number;
  perfectCount: number;
  goodCount: number;
  badCount: number;
  missCount: number;
  wrongCount: number;
  maxCombo: number;
  gameResetCount: number;
  gameFileName: string | null;
  gameSpeed: number;
  gameAudioUrl: string | null;
  gameAudioVolume: number;
  levelMetadata: { title?: string; author?: string; description?: string; midiCredit?: string; } | null;
  latestHit: HitEvent | null;

  history: GameHistorySnapshot[];
  historyIndex: number;
  historyLimit: number;

  setGameEvents: (events: GameEvent[]) => void;
  setGamePhase: (phase: GamePhase) => void;
  setGameFileName: (name: string | null) => void;
  setGameStats: (stats: Partial<Pick<GameState, 'gameScore' | 'gameCombo' | 'perfectCount' | 'goodCount' | 'badCount' | 'missCount' | 'wrongCount' | 'maxCombo' | 'latestHit'>>) => void;
  setGameSpeed: (speed: number) => void;
  setGameAudioUrl: (url: string | null) => void;
  setGameAudioVolume: (v: number) => void;
  setLevelMetadata: (metadata: GameSpecificState['levelMetadata']) => void;
  resetGamePlay: () => void;
  pushUndoSnapshot: () => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export type GameState = CanvasSliceState & CanvasSliceActions & GameSpecificState;

export const useGameStore = create<GameState>()((set, get) => ({
  // Canvas slice initial state: blocks, groupRects, tracks, camera, mode, selections, pocket, etc.
  ...INITIAL_CANVAS_STATE,

  // Canvas slice actions: addBlock, updateBlock, selectBlock, addGroupRect, updateCamera, etc.
  ...buildCanvasActions(set as Parameters<typeof buildCanvasActions>[0], get),

  // Game-specific state
  gameEvents: [],
  gamePhase: 'upload',
  gameScore: 0,
  gameCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  badCount: 0,
  missCount: 0,
  wrongCount: 0,
  maxCombo: 0,
  gameResetCount: 0,
  gameFileName: null,
  gameSpeed: 1,
  gameAudioUrl: null,
  gameAudioVolume: 1,
  levelMetadata: null,
  latestHit: null,

  history: [],
  historyIndex: -1,
  historyLimit: 50,

  // Game-specific actions
  setGameEvents: (gameEvents) => set((s) => ({ ...s, gameEvents })),
  setGamePhase: (gamePhase) => set((s) => {
    if (gamePhase === 'upload') {
      return { ...s, gamePhase, history: [], historyIndex: -1 };
    }
    if (gamePhase === 'arrange') {
      // Snapshot current block layout as the base history entry for this session
      const snapshot: GameHistorySnapshot = {
        blocks: JSON.parse(JSON.stringify(s.blocks)),
        groupRects: JSON.parse(JSON.stringify(s.groupRects)),
        tracks: JSON.parse(JSON.stringify(s.tracks)),
      };
      return { ...s, gamePhase, history: [snapshot], historyIndex: 0 };
    }
    return { ...s, gamePhase };
  }),
  setGameFileName: (gameFileName) => set((s) => ({ ...s, gameFileName })),
  setGameStats: (stats) => set((s) => ({ ...s, ...stats })),
  setGameSpeed: (gameSpeed) => set((s) => ({ ...s, gameSpeed })),
  setGameAudioUrl: (gameAudioUrl) => set((s) => ({ ...s, gameAudioUrl })),
  setGameAudioVolume: (gameAudioVolume) => set((s) => ({ ...s, gameAudioVolume })),
  setLevelMetadata: (levelMetadata) => set((s) => ({ ...s, levelMetadata })),
  resetGamePlay: () => set((s) => ({
    ...s,
    gameResetCount: s.gameResetCount + 1,
    gameScore: 0, gameCombo: 0, perfectCount: 0, goodCount: 0,
    badCount: 0, missCount: 0, wrongCount: 0, maxCombo: 0, latestHit: null
  })),

  pushUndoSnapshot: () => {
    // No-op: the arrange-entry snapshot serves as the pre-drag baseline.
    // commitHistory() on drag-end saves the post-drag state.
  },

  commitHistory: () => {
    const s = get();
    const snapshot: GameHistorySnapshot = {
      blocks: JSON.parse(JSON.stringify(s.blocks)),
      groupRects: JSON.parse(JSON.stringify(s.groupRects)),
      tracks: JSON.parse(JSON.stringify(s.tracks)),
    };
    const newHistory = s.history.slice(0, s.historyIndex + 1);
    newHistory.push(snapshot);
    if (newHistory.length > s.historyLimit) {
      newHistory.splice(0, newHistory.length - s.historyLimit);
    }
    set((cur) => ({ ...cur, history: newHistory, historyIndex: newHistory.length - 1 }));
  },

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0) return;
    const newIndex = s.historyIndex - 1;
    const snapshot = s.history[newIndex];
    set((cur) => ({
      ...cur,
      blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
      groupRects: JSON.parse(JSON.stringify(snapshot.groupRects)),
      tracks: JSON.parse(JSON.stringify(snapshot.tracks)),
      historyIndex: newIndex,
    }));
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const newIndex = s.historyIndex + 1;
    const snapshot = s.history[newIndex];
    set((cur) => ({
      ...cur,
      blocks: JSON.parse(JSON.stringify(snapshot.blocks)),
      groupRects: JSON.parse(JSON.stringify(snapshot.groupRects)),
      tracks: JSON.parse(JSON.stringify(snapshot.tracks)),
      historyIndex: newIndex,
    }));
  },
}));
