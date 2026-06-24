import { isLevelEditor } from '../utils/routeUtils';
import type { AppState, StoreSet } from './storeTypes';
import type { Block, Track, GroupRect, Runner, CameraState } from '../types';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export interface CanvasState {
  blocks: Block[];
  tracks: Track[];
  groupRects: GroupRect[];
  runners: Runner[];
  camera: CameraState;
  selectedBlockIds: string[];
  selectedTrackIds: string[];
  selectedGroupRectIds: string[];
}

export const getCanvasKeys = (isEditor: boolean): Record<keyof CanvasState, keyof AppState> => ({
  blocks: isEditor ? 'editorBlocks' : 'blocks',
  tracks: isEditor ? 'editorTracks' : 'tracks',
  groupRects: isEditor ? 'editorGroupRects' : 'groupRects',
  runners: isEditor ? 'editorRunners' : 'runners',
  camera: isEditor ? 'editorCamera' : 'camera',
  selectedBlockIds: 'selectedBlockIds',
  selectedTrackIds: 'selectedTrackIds',
  selectedGroupRectIds: 'selectedGroupRectIds',
});

export const updateCanvas = (
  set: StoreSet,
  updater: (canvas: CanvasState, state: AppState) => Partial<CanvasState> & Partial<AppState>
) => {
  set((state: AppState) => {
    const isEditor = isLevelEditor();
    const keys = getCanvasKeys(isEditor);
    
    const canvasView: CanvasState = {
      blocks: state[keys.blocks] as Block[],
      tracks: state[keys.tracks] as Track[],
      groupRects: state[keys.groupRects] as GroupRect[],
      runners: state[keys.runners] as Runner[],
      camera: state[keys.camera] as CameraState,
      selectedBlockIds: state[keys.selectedBlockIds] as string[],
      selectedTrackIds: state[keys.selectedTrackIds] as string[],
      selectedGroupRectIds: state[keys.selectedGroupRectIds] as string[],
    };

    const canvasUpdates = updater(canvasView, state);
    
    const actualUpdates: Partial<AppState> = { ...canvasUpdates };
    for (const key of Object.keys(keys) as Array<keyof CanvasState>) {
       if (key in canvasUpdates) {
         const targetKey = keys[key];
         // @ts-expect-error dynamic key assignment
         actualUpdates[targetKey] = canvasUpdates[key];
         if (targetKey !== key) {
           delete actualUpdates[key];
         }
       }
    }
    
    return actualUpdates;
  });
};
