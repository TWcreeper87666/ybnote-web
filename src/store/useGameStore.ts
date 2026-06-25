import { create } from 'zustand';
import type { Block, HitEvent } from '../types';

export type GameEvent = { time: number; pitch: string; instrument: string; blockId: string; };
export type GamePhase = 'upload' | 'arrange' | 'play' | 'paused' | 'result';

interface GameState {
  gameBlocks: Block[];
  gameEvents: GameEvent[];
  gamePhase: GamePhase;
  gameCamera: { x: number; y: number; zoom: number };
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

  setGameBlocks: (blocks: Block[]) => void;
  updateGameBlock: (id: string, updates: Partial<Block>) => void;
  updateGameBlocks: (updates: { id: string; updates: Partial<Block> }[]) => void;
  setGameEvents: (events: GameEvent[]) => void;
  setGamePhase: (phase: GamePhase) => void;
  setGameFileName: (name: string | null) => void;
  updateGameCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;
  setGameStats: (stats: Partial<Pick<GameState, 'gameScore' | 'gameCombo' | 'perfectCount' | 'goodCount' | 'badCount' | 'missCount' | 'wrongCount' | 'maxCombo' | 'latestHit'>>) => void;
  setGameSpeed: (speed: number) => void;
  setGameAudioUrl: (url: string | null) => void;
  setGameAudioVolume: (v: number) => void;
  setLevelMetadata: (metadata: GameState['levelMetadata']) => void;
  resetGamePlay: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  gameBlocks: [],
  gameEvents: [],
  gamePhase: 'upload',
  gameCamera: { x: 0, y: 0, zoom: 1 },
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

  setGameBlocks: (gameBlocks) => set({ gameBlocks }),
  updateGameBlock: (id, updates) => set((state) => ({
    gameBlocks: state.gameBlocks.map(b => b.id === id ? { ...b, ...updates } : b)
  })),
  updateGameBlocks: (updates) => set((state) => {
    const map = new Map(updates.map(u => [u.id, u.updates]));
    return { gameBlocks: state.gameBlocks.map(b => map.has(b.id) ? { ...b, ...map.get(b.id)! } : b) };
  }),
  setGameEvents: (gameEvents) => set({ gameEvents }),
  setGamePhase: (gamePhase) => set({ gamePhase }),
  setGameFileName: (gameFileName) => set({ gameFileName }),
  updateGameCamera: (camera) => set((state) => ({ gameCamera: { ...state.gameCamera, ...camera } })),
  setGameStats: (stats) => set((state) => ({ ...state, ...stats })),
  setGameSpeed: (gameSpeed) => set({ gameSpeed }),
  setGameAudioUrl: (gameAudioUrl) => set({ gameAudioUrl }),
  setGameAudioVolume: (gameAudioVolume) => set({ gameAudioVolume }),
  setLevelMetadata: (levelMetadata) => set({ levelMetadata }),
  resetGamePlay: () => set((s) => ({
    gameResetCount: s.gameResetCount + 1,
    gameScore: 0, gameCombo: 0, perfectCount: 0, goodCount: 0,
    badCount: 0, missCount: 0, wrongCount: 0, maxCombo: 0, latestHit: null
  })),
}));
