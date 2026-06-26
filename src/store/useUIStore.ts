import { create } from 'zustand';

interface UIState {
  isOutlinerOpen: boolean;
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  isPianoOpen: boolean;
  isPocketCanvasOpen: boolean;
  isTutorialOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  toastMessage: { text: string; id: number } | null;

  toggleOutliner: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  togglePiano: () => void;
  togglePocketCanvas: () => void;
  toggleTutorial: () => void;
  setSearchOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  showToast: (msg: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isOutlinerOpen: false,
  isSettingsOpen: false,
  isHelpOpen: false,
  isPianoOpen: false,
  isPocketCanvasOpen: false,
  isTutorialOpen: false,
  isSearchOpen: false,
  searchQuery: '',
  toastMessage: null,

  toggleOutliner: () => set((s) => ({ isOutlinerOpen: !s.isOutlinerOpen })),
  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen, isHelpOpen: false, isTutorialOpen: false })),
  toggleHelp: () => set((s) => ({ isHelpOpen: !s.isHelpOpen, isSettingsOpen: false, isTutorialOpen: false })),
  togglePiano: () => set((s) => ({ isPianoOpen: !s.isPianoOpen })),
  togglePocketCanvas: () => set((s) => ({ isPocketCanvasOpen: !s.isPocketCanvasOpen })),
  toggleTutorial: () => set((s) => ({ isTutorialOpen: !s.isTutorialOpen, isSettingsOpen: false, isHelpOpen: false })),
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  showToast: (msg) => set({ toastMessage: { text: msg, id: Date.now() } }),
}));
