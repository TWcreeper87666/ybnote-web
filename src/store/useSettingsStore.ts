import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types';

const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

interface SettingsState {
  theme: Theme;
  showGrid: boolean;
  snapToGrid: boolean;
  showGroupName: boolean;
  showBlockPitch: boolean;
  showBlockVolume: boolean;
  showBlockInstrument: boolean;
  showSelectionHud: boolean;
  pianoKeysCount: number;
  blockOpacity: number;
  mouseSensitivity: number;
  masterVolume: number;
  mobileControlMode: 'crosshair' | 'touch';

  setTheme: (theme: Theme) => void;
  setGridConfig: (config: { showGrid?: boolean; snapToGrid?: boolean }) => void;
  setDisplaySettings: (settings: Partial<Pick<SettingsState, 'showGroupName' | 'showBlockPitch' | 'showBlockVolume' | 'showBlockInstrument' | 'showSelectionHud'>>) => void;
  setPianoKeysCount: (count: number) => void;
  setBlockOpacity: (opacity: number) => void;
  setMouseSensitivity: (sensitivity: number) => void;
  setMasterVolume: (volume: number) => void;
  setMobileControlMode: (mode: 'crosshair' | 'touch') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: getSystemTheme(),
      showGrid: true,
      snapToGrid: true,
      showGroupName: true,
      showBlockPitch: true,
      showBlockVolume: true,
      showBlockInstrument: true,
      showSelectionHud: true,
      pianoKeysCount: 36,
      blockOpacity: 1,
      mouseSensitivity: 1,
      masterVolume: 1,
      mobileControlMode: 'touch',

      setTheme: (theme) => set({ theme }),
      setGridConfig: (config) => set((state) => ({ ...state, ...config })),
      setDisplaySettings: (settings) => set((state) => ({ ...state, ...settings })),
      setPianoKeysCount: (pianoKeysCount) => set({ pianoKeysCount }),
      setBlockOpacity: (blockOpacity) => set({ blockOpacity }),
      setMouseSensitivity: (mouseSensitivity) => set({ mouseSensitivity }),
      setMasterVolume: (volume) => {
        import('../utils/audio').then(({ setMasterVolume }) => setMasterVolume(volume));
        set({ masterVolume: volume });
      },
      setMobileControlMode: (mobileControlMode) => set({ mobileControlMode }),
    }),
    { name: 'ybnote-settings' }
  )
);
