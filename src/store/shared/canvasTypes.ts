import type { StoreApi, UseBoundStore } from "zustand";
import type {
  Block,
  CameraState,
  Group,
  GroupRect,
  Mode,
  Runner,
  Track,
  TrackNode,
} from "../../types";

/** 各 store 內 canvas 相關 state + actions 的統一介面（欄位名稱一致，不靠 editor 前綴區分） */
export interface CanvasFeature {
  blocks: Block[];
  groups: Group[];
  groupRects: GroupRect[];
  tracks: Track[];
  runners: Runner[];

  selectedBlockIds: string[];
  selectedTrackIds: string[];
  selectedGroupRectIds: string[];

  clipboardBlocks: Block[];
  clipboardTracks: Track[];
  clipboardGroupRects: GroupRect[];

  camera: CameraState;

  hoveredBlockId: string | null;
  hoveredGroupRectId: string | null;
  activeNodeDrag: {
    trackId: string;
    nodeId: string;
    isNewNode?: boolean;
  } | null;

  lastSelectedId: string | null;
  lastSelectedType: "block" | "groupRect" | "track" | null;

  latestPerformHit: { time: number; color: number } | null;
  openContextMenu: ({
    x,
    y,
    blockId,
  }: {
    x: number;
    y: number;
    blockId: string;
  }) => void;

  mode: Mode;
  setMode: (mode: Mode) => void;

  addBlock: (block: Omit<Block, "id">) => string;
  addBlocks: (blocks: Omit<Block, "id">[]) => string[];
  removeBlock: (id: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  updateBlocks: (updates: { id: string; updates: Partial<Block> }[]) => void;
  deleteSelected: () => void;
  selectBlock: (id: string, multi?: boolean) => void;
  selectTrack: (id: string, multi?: boolean) => void;
  selectGroupRect: (id: string, multi?: boolean) => void;
  selectAll: () => void;
  selectAllBlocks: () => void;
  clearSelection: () => void;
  mutateBlocks: (
    targetIds: string[],
    mutator: (block: Block) => Partial<Block>,
    options?: { continuous?: boolean },
  ) => void;

  groupSelected: () => void;
  ungroupSelected: () => void;
  updateGroup: (id: string, name: string) => void;

  addGroupRect: (groupRect: Omit<GroupRect, "id">) => string;
  updateGroupRect: (id: string, updates: Partial<GroupRect>) => void;
  removeGroupRect: (id: string) => void;

  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;

  updateCamera: (camera: Partial<CameraState>) => void;
  setHoveredBlockId: (id: string | null) => void;
  setHoveredGroupRectId: (id: string | null) => void;
  setActiveNodeDrag: (
    state: { trackId: string; nodeId: string; isNewNode?: boolean } | null,
  ) => void;

  addTrack: (track: Omit<Track, "id">) => string;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  addTrackNode: (trackId: string, node: Omit<TrackNode, "id">) => string;
  insertTrackNode: (
    trackId: string,
    index: number,
    node: Omit<TrackNode, "id">,
  ) => string;
  removeTrackNode: (trackId: string, nodeId: string) => void;
  updateTrackNode: (
    trackId: string,
    nodeId: string,
    updates: Partial<TrackNode>,
  ) => void;
  setRunners: (runners: Runner[]) => void;

  setLatestPerformHit: (hit: { time: number; color: number }) => void;
}

export type CanvasStore = UseBoundStore<StoreApi<CanvasFeature>>;

/** persist 時各 store 各自 partialize 同名欄位即可 */
export const canvasPersistKeys = [
  "blocks",
  "groups",
  "groupRects",
  "tracks",
  "runners",
  "camera",
] as const satisfies readonly (keyof CanvasFeature)[];

export type CanvasPersistSlice = Pick<
  CanvasFeature,
  (typeof canvasPersistKeys)[number]
>;
