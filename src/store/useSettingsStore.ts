import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "../types";

type SettingsState = {
  theme: Theme;

  showGrid: boolean;
  snapToGrid: boolean;

  showGroupName: boolean;
  showBlockPitch: boolean;
  showBlockVolume: boolean;
  showBlockInstrument: boolean;

  pianoKeysCount: number;
  blockOpacity: number;
  mouseSensitivity: number;
  masterVolume: number;

  setTheme: (theme: Theme) => void;
  setGridConfig: (config: { showGrid?: boolean; snapToGrid?: boolean }) => void;
  setDisplaySettings: (
    settings: Partial<{
      showGroupName: boolean;
      showBlockPitch: boolean;
      showBlockVolume: boolean;
      showBlockInstrument: boolean;
    }>,
  ) => void;

  setPianoKeysCount: (count: number) => void;
  setBlockOpacity: (opacity: number) => void;
  setMouseSensitivity: (sensitivity: number) => void;
  setMasterVolume: (volume: number) => void;

  updateSettings: (settings: Partial<SettingsState>) => void;
  resetSettings: () => void;
};

const getSystemTheme = (): Theme => {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
};

const defaultSettings = {
  theme: getSystemTheme(),
  showGrid: true,
  snapToGrid: true,
  showGroupName: true,
  showBlockPitch: true,
  showBlockVolume: true,
  showBlockInstrument: true,
  pianoKeysCount: 36,
  blockOpacity: 1,
  mouseSensitivity: 1,
  masterVolume: 1,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme) => set({ theme }),

      setGridConfig: (config) =>
        set((state) => ({
          ...state,
          ...config,
        })),

      setDisplaySettings: (settings) =>
        set((state) => ({
          ...state,
          ...settings,
        })),

      setPianoKeysCount: (count) => set({ pianoKeysCount: count }),

      setBlockOpacity: (opacity) => set({ blockOpacity: opacity }),

      setMouseSensitivity: (sensitivity) =>
        set({ mouseSensitivity: sensitivity }),

      setMasterVolume: (volume) => {
        import("../utils/audio").then(({ setMasterVolume }) => {
          setMasterVolume(volume);
        });
        set({ masterVolume: volume });
      },

      updateSettings: (settings) =>
        set((state) => ({
          ...state,
          ...settings,
        })),

      resetSettings: () =>
        set({
          ...defaultSettings,
          theme: getSystemTheme(),
        }),
    }),
    {
      name: "ybnote-settings",
      partialize: (state) => ({
        theme: state.theme,
        showGrid: state.showGrid,
        snapToGrid: state.snapToGrid,
        showGroupName: state.showGroupName,
        showBlockPitch: state.showBlockPitch,
        showBlockVolume: state.showBlockVolume,
        showBlockInstrument: state.showBlockInstrument,
        pianoKeysCount: state.pianoKeysCount,
        blockOpacity: state.blockOpacity,
        mouseSensitivity: state.mouseSensitivity,
        masterVolume: state.masterVolume,
      }),
    },
  ),
);
