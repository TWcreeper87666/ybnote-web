import { create } from "zustand";

interface UIState {
  isOutlinerOpen: boolean;
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  isPocketCanvasOpen: boolean;
  isTutorialOpen: boolean;
  toastMessage: { text: string; id: number } | null;

  // toggle
  toggleOutliner: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  togglePocketCanvas: () => void;
  toggleTutorial: () => void;

  // setter
  setOutlinerOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setPocketCanvasOpen: (v: boolean) => void;
  setTutorialOpen: (v: boolean) => void;

  showToast: (msg: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isOutlinerOpen: false,
  isSettingsOpen: false,
  isHelpOpen: false,
  isPocketCanvasOpen: false,
  isTutorialOpen: false,
  toastMessage: null,

  // -------------------
  // toggle
  // -------------------
  toggleOutliner: () => set((s) => ({ isOutlinerOpen: !s.isOutlinerOpen })),

  toggleSettings: () =>
    set((s) => ({
      isSettingsOpen: !s.isSettingsOpen,
      isHelpOpen: false,
      isTutorialOpen: false,
    })),

  toggleHelp: () =>
    set((s) => ({
      isHelpOpen: !s.isHelpOpen,
      isSettingsOpen: false,
      isTutorialOpen: false,
    })),

  togglePocketCanvas: () =>
    set((s) => ({ isPocketCanvasOpen: !s.isPocketCanvasOpen })),

  toggleTutorial: () =>
    set((s) => ({
      isTutorialOpen: !s.isTutorialOpen,
      isSettingsOpen: false,
      isHelpOpen: false,
    })),

  setOutlinerOpen: (v) => set({ isOutlinerOpen: v }),
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setHelpOpen: (v) => set({ isHelpOpen: v }),
  setPocketCanvasOpen: (v) => set({ isPocketCanvasOpen: v }),
  setTutorialOpen: (v) => set({ isTutorialOpen: v }),

  showToast: (msg) => set({ toastMessage: { text: msg, id: Date.now() } }),
}));
