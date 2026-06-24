import type { StoreSlice } from "./storeTypes";

export interface UISlice {
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

  contextMenu: { x: number; y: number; blockId: string } | null;
  toastMessage: { text: string; id: number } | null;
  levelMetadata: {
    title?: string;
    author?: string;
    description?: string;
    midiCredit?: string;
  } | null;

  openContextMenu: (menu: { x: number; y: number; blockId: string }) => void;
  closeContextMenu: () => void;
  toggleContextMenu: (menu: { x: number; y: number; blockId: string }) => void;
  togglePiano: () => void;
  toggleSettings: () => void;
  toggleHelp: () => void;
  toggleOutliner: () => void;
  togglePocketCanvas: () => void;
  toggleTutorial: () => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (isOpen: boolean) => void;
  showToast: (msg: string) => void;
  setLevelMetadata: (metadata: UISlice["levelMetadata"]) => void;
}

export const createUISlice: StoreSlice<UISlice> = (set) => ({
  isPianoOpen: false,
  isSettingsOpen: false,
  isHelpOpen: false,
  isOutlinerOpen: false,
  isPocketCanvasOpen: false,
  isTutorialOpen: false,
  searchQuery: "",
  isSearchOpen: false,

  contextMenu: null,
  toastMessage: null,
  levelMetadata: null,

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  toggleContextMenu: (menu) =>
    set((state) => ({
      contextMenu: state.contextMenu?.blockId === menu.blockId ? null : menu,
    })),
  togglePiano: () => set((state) => ({ isPianoOpen: !state.isPianoOpen })),
  toggleSettings: () =>
    set((state) => ({
      isSettingsOpen: !state.isSettingsOpen,
      isHelpOpen: false,
      isTutorialOpen: false,
    })),
  toggleHelp: () =>
    set((state) => ({
      isHelpOpen: !state.isHelpOpen,
      isSettingsOpen: false,
      isTutorialOpen: false,
    })),
  toggleOutliner: () =>
    set((state) => ({ isOutlinerOpen: !state.isOutlinerOpen })),
  togglePocketCanvas: () =>
    set((state) => ({
      isPocketCanvasOpen: !state.isPocketCanvasOpen,
      interactionContext:
        state.isPocketCanvasOpen && state.interactionContext === "pocket"
          ? "main"
          : state.interactionContext,
    })),
  toggleTutorial: () =>
    set((state) => ({
      isTutorialOpen: !state.isTutorialOpen,
      isSettingsOpen: false,
      isHelpOpen: false,
    })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
  showToast: (msg) => set({ toastMessage: { text: msg, id: Date.now() } }),
  setLevelMetadata: (levelMetadata) => set({ levelMetadata }),
});
