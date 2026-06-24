import { create } from 'zustand';
import type { HitEvent, Block } from '../types';

export interface GameStoreState {
  gameState: 'upload' | 'arrange' | 'play' | 'paused' | 'result';
  gameFileName: string | null;
  /** 播放期間的 blocks（從 level 載入，不 persist） */
  blocks: Block[];
  gameSpeed: number;
  events: { time: number; pitch: string; instrument: string; blockId: string }[];
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
  latestPerformHit: { time: number; color: number } | null;

  setGameState: (state: GameStoreState['gameState']) => void;
  setGameFileName: (name: string | null) => void;
  setBlocks: (blocks: Block[]) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  setEvents: (events: GameStoreState['events']) => void;
  setGameStats: (
    stats: Partial<{
      gameScore: number;
      gameCombo: number;
      perfectCount: number;
      goodCount: number;
      badCount: number;
      missCount: number;
      wrongCount: number;
      maxCombo: number;
      latestHit: HitEvent | null;
    }>,
  ) => void;
  setGameSpeed: (speed: number) => void;
  setMobileControlMode: (mode: 'crosshair' | 'touch') => void;
  resetGamePlay: () => void;
  setGameAudioUrl: (url: string | null) => void;
  setGameAudioVolume: (v: number) => void;
  updateGameCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;
  setLatestPerformHit: (hit: { time: number; color: number }) => void;

  /** 從 level-editor 或 .yblevel 載入播放資料 */
  loadFromLevel: (data: {
    blocks: Block[];
    events: GameStoreState['events'];
    audioUrl?: string | null;
    fileName?: string | null;
  }) => void;
}

export const useGameStore = create<GameStoreState>()((set) => ({
  gameState: 'upload',
  gameFileName: null,
  blocks: [],
  gameSpeed: 1,
  events: [],
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
  setBlocks: (blocks) => set({ blocks }),
  updateBlock: (id, updates) =>
    set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),
  setEvents: (events) => set({ events }),
  setGameStats: (stats) => set((s) => ({ ...s, ...stats })),
  setGameSpeed: (gameSpeed) => set({ gameSpeed }),
  setMobileControlMode: (mobileControlMode) => set({ mobileControlMode }),
  resetGamePlay: () =>
    set((s) => ({
      gameResetCount: s.gameResetCount + 1,
      gameScore: 0,
      gameCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      badCount: 0,
      missCount: 0,
      wrongCount: 0,
      maxCombo: 0,
      latestHit: null,
      blocks: [],
      events: [],
    })),
  setGameAudioUrl: (url) => set({ gameAudioUrl: url }),
  setGameAudioVolume: (v) => set({ gameAudioVolume: v }),
  updateGameCamera: (camera) => set((s) => ({ gameCamera: { ...s.gameCamera, ...camera } })),
  setLatestPerformHit: (hit) => set({ latestPerformHit: hit }),

  loadFromLevel: ({ blocks, events, audioUrl, fileName }) =>
    set({
      blocks: JSON.parse(JSON.stringify(blocks)),
      events: JSON.parse(JSON.stringify(events)),
      ...(audioUrl !== undefined && { gameAudioUrl: audioUrl }),
      ...(fileName !== undefined && { gameFileName: fileName }),
      gameScore: 0,
      gameCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      badCount: 0,
      missCount: 0,
      wrongCount: 0,
      maxCombo: 0,
      latestHit: null,
    }),
}));
