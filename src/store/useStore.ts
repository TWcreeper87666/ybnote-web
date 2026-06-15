import { create } from 'zustand';

interface Block {
  id: string;
  x: number;
  y: number;
  pitch: string; // e.g., 'C4', 'D#4'
  instrument: string; // e.g., 'piano'
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface AppState {
  blocks: Block[];
  camera: CameraState;
  theme: 'light' | 'dark';
  showGrid: boolean;
  snapToGrid: boolean;
  
  // Actions
  addBlock: (block: Block) => void;
  removeBlock: (id: string) => void;
  updateCamera: (camera: Partial<CameraState>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setGridConfig: (config: { showGrid?: boolean; snapToGrid?: boolean }) => void;
}

export const useStore = create<AppState>((set) => ({
  blocks: [],
  camera: { x: 0, y: 0, zoom: 1 },
  theme: 'light',
  showGrid: true,
  snapToGrid: true,

  addBlock: (block) => set((state) => ({ blocks: [...state.blocks, block] })),
  removeBlock: (id) => set((state) => ({ blocks: state.blocks.filter((b) => b.id !== id) })),
  updateCamera: (cameraUpdates) => set((state) => ({ camera: { ...state.camera, ...cameraUpdates } })),
  setTheme: (theme) => set({ theme }),
  setGridConfig: (config) => set((state) => ({ ...state, ...config })),
}));
