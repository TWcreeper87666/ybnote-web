import type { StoreSlice } from './storeTypes';
import type { Theme } from '../types';

export interface UISlice {
  theme: Theme;
  isPianoOpen: boolean;
  isSettingsOpen: boolean;
  isHelpOpen: boolean;
  isOutlinerOpen: boolean;
  isPocketCanvasOpen: boolean;
  isTutorialOpen: boolean;
  uiStateBeforePlay?: {
    isPianoOpen: boolean;
    isSettingsOpen: boolean;
    isHelpOpen: boolean;
    isOutlinerOpen: boolean;
    isSearchOpen: boolean;
    selectedBlockIds: string[];
    selectedTrackIds: string[];
    selectedGroupRectIds: string[];
    activeTrackId: string | null;
  };
  searchQuery: string;
  isSearchOpen: boolean;

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
  contextMenu: { x: number, y: number, blockId: string } | null;

  toastMessage: { text: string; id: number } | null;
  levelMetadata: {
    title?: string;
    author?: string;
    description?: string;
    midiCredit?: string;
  } | null;

  setTheme: (theme: Theme) => void;
  setGridConfig: (config: { showGrid?: boolean; snapToGrid?: boolean }) => void;
  setPianoKeysCount: (count: number) => void;
  setBlockOpacity: (opacity: number) => void;
  setMouseSensitivity: (sensitivity: number) => void;
  setMasterVolume: (volume: number) => void;
  openContextMenu: (menu: { x: number, y: number, blockId: string }) => void;
  closeContextMenu: () => void;
  toggleContextMenu: (menu: { x: number, y: number, blockId: string }) => void;
  togglePiano: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  toggleOutliner: () => void;
  togglePocketCanvas: () => void;
  toggleTutorial: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  setDisplaySettings: (settings: Partial<{ showGroupName: boolean, showBlockPitch: boolean, showBlockVolume: boolean, showBlockInstrument: boolean }>) => void;
  showToast: (msg: string) => void;
  setLevelMetadata: (metadata: UISlice['levelMetadata']) => void;
}

const getSystemTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const createUISlice: StoreSlice<UISlice> = (set) => ({
  theme: getSystemTheme(),
  showGrid: true,
  snapToGrid: true,
  isPianoOpen: false,
  isSettingsOpen: false,
  isHelpOpen: false,
  isOutlinerOpen: false,
  isPocketCanvasOpen: false,
  isTutorialOpen: false,
  searchQuery: '',
  isSearchOpen: false,

  showGroupName: true,
  showBlockPitch: true,
  showBlockVolume: true,
  showBlockInstrument: true,

  pianoKeysCount: 36,
  blockOpacity: 1,
  mouseSensitivity: 1,
  masterVolume: 1,
  contextMenu: null,

  toastMessage: null,
  levelMetadata: null,

  setTheme: (theme) => set({ theme }),
  setGridConfig: (config) => set((state) => ({ ...state, ...config })),
  setPianoKeysCount: (count) => set({ pianoKeysCount: count }),
  setBlockOpacity: (opacity) => set({ blockOpacity: opacity }),
  setMouseSensitivity: (mouseSensitivity) => set({ mouseSensitivity }),
  setMasterVolume: (volume) => {
    import('../utils/audio').then(({ setMasterVolume }) => setMasterVolume(volume));
    set({ masterVolume: volume });
  },
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  toggleContextMenu: (menu) => set((state) => ({ contextMenu: state.contextMenu?.blockId === menu.blockId ? null : menu })),
  togglePiano: () => set((state) => ({ isPianoOpen: !state.isPianoOpen })),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isHelpOpen: false, isTutorialOpen: false })),
  toggleHelp: () => set((state) => ({ isHelpOpen: !state.isHelpOpen, isSettingsOpen: false, isTutorialOpen: false })),
  toggleOutliner: () => set((state) => ({ isOutlinerOpen: !state.isOutlinerOpen })),
  togglePocketCanvas: () => set((state) => ({ 
    isPocketCanvasOpen: !state.isPocketCanvasOpen,
    interactionContext: state.isPocketCanvasOpen && state.interactionContext === 'pocket' ? 'main' : state.interactionContext
  })),
  toggleTutorial: () => set((state) => ({ isTutorialOpen: !state.isTutorialOpen, isSettingsOpen: false, isHelpOpen: false })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
  setDisplaySettings: (settings) => set((state) => ({ ...state, ...settings })),
  showToast: (msg) => set({ toastMessage: { text: msg, id: Date.now() } }),
  setLevelMetadata: (levelMetadata) => set({ levelMetadata }),
});
