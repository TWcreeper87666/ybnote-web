import type { StoreSlice } from './storeTypes';
import type { Block, HitEvent } from '../types';

export interface GameSlice {
  gameState: 'upload' | 'arrange' | 'play' | 'paused' | 'result';
  gameFileName: string | null;
  gameBlocks: Block[];
  gameSpeed: number;
  gameEvents: { time: number; pitch: string; instrument: string; blockId: string; }[];
  gameScore: number;
  gameCombo: number;
  perfectCount: number;
  goodCount: number;
  badCount: number;
  missCount: number;
  wrongCount: number;
  maxCombo: number;
  gameResetCount: number;
  mobileControlMode: 'crosshair' | 'touch';
  latestHit: HitEvent | null;
  gameAudioUrl: string | null;
  gameAudioVolume: number;
  gameCamera: { x: number; y: number; zoom: number };
  latestPerformHit: { time: number, color: number } | null;

  setGameState: (state: GameSlice['gameState']) => void;
  setGameFileName: (name: string | null) => void;
  setGameBlocks: (blocks: Block[]) => void;
  updateGameBlock: (id: string, updates: Partial<Block>) => void;
  setGameEvents: (events: GameSlice['gameEvents']) => void;
  setGameStats: (stats: Partial<{ gameScore: number, gameCombo: number, perfectCount: number, goodCount: number, badCount: number, missCount: number, wrongCount: number, maxCombo: number, latestHit: HitEvent | null }>) => void;
  setGameSpeed: (speed: number) => void;
  setMobileControlMode: (mode: 'crosshair' | 'touch') => void;
  resetGamePlay: () => void;
  setGameAudioUrl: (url: string | null) => void;
  setGameAudioVolume: (v: number) => void;
  updateGameCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;
  setLatestPerformHit: (hit: { time: number, color: number }) => void;
}

export const createGameSlice: StoreSlice<GameSlice> = (set) => ({
  gameState: 'upload',
  gameFileName: null,
  gameBlocks: [],
  gameSpeed: 1,
  gameEvents: [],
  gameScore: 0,
  gameCombo: 0,
  perfectCount: 0,
  goodCount: 0,
  badCount: 0,
  missCount: 0,
  wrongCount: 0,
  maxCombo: 0,
  gameResetCount: 0,
  mobileControlMode: 'touch',
  latestHit: null,
  gameAudioUrl: null,
  gameAudioVolume: 1,
  gameCamera: { x: 0, y: 0, zoom: 1 },
  latestPerformHit: null,

  setGameState: (gameState) => set({ gameState }),
  setGameFileName: (gameFileName) => set({ gameFileName }),
  setGameBlocks: (gameBlocks) => set({ gameBlocks }),
  updateGameBlock: (id, updates) => set((state) => ({
     gameBlocks: state.gameBlocks.map(b => b.id === id ? { ...b, ...updates } : b)
  })),
  setGameEvents: (gameEvents) => set({ gameEvents }),
  setGameStats: (stats) => set(state => ({ ...state, ...stats })),
  setGameSpeed: (gameSpeed) => set({ gameSpeed }),
  setMobileControlMode: (mobileControlMode) => set({ mobileControlMode }),
  resetGamePlay: () => set((s) => ({ gameResetCount: s.gameResetCount + 1, gameScore: 0, gameCombo: 0, perfectCount: 0, goodCount: 0, badCount: 0, missCount: 0, wrongCount: 0, maxCombo: 0, latestHit: null })),
  setGameAudioUrl: (url) => set({ gameAudioUrl: url }),
  setGameAudioVolume: (v) => set({ gameAudioVolume: v }),
  updateGameCamera: (camera) => set((state) => ({ gameCamera: { ...state.gameCamera, ...camera } })),
  setLatestPerformHit: (hit) => set({ latestPerformHit: hit }),
});
