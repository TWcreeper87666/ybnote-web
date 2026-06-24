import type { StateCreator } from 'zustand';
import type { UISlice } from './uiSlice';
import type { CanvasSlice } from './canvasSlice';
import type { PocketSlice } from './pocketSlice';
import type { PlaybackSlice } from './playbackSlice';
import type { GameSlice } from './gameSlice';

export type AppState = UISlice & CanvasSlice & PocketSlice & PlaybackSlice & GameSlice;

export type StoreSlice<T> = StateCreator<
  AppState,
  [['temporal', unknown]],
  [],
  T
>;

export type StoreSet = {
  (partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>), replace?: false | undefined): void;
  (state: AppState | ((state: AppState) => AppState), replace: true): void;
};
export type StoreGet = () => AppState;
