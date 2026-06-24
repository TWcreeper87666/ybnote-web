import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { isLevelEditor } from '../utils/routeUtils';
import type { AppState } from './storeTypes';
import type { Block, Track, GroupRect } from '../types';

import { createUISlice } from './uiSlice';
import { createPocketSlice } from './pocketSlice';
import { createPlaybackSlice } from './playbackSlice';
import { createGameSlice } from './gameSlice';
import { createCanvasSlice } from './canvasSlice';

export const useStore = create<AppState>()(
  temporal(
    persist(
      (...a) => ({
        ...createUISlice(...a),
        ...createPocketSlice(...a),
        ...createPlaybackSlice(...a),
        ...createGameSlice(...a),
        ...createCanvasSlice(...a),
      }),
      {
        name: 'ybnote-storage',
        partialize: (state) => ({
          blocks: state.blocks,
          groups: state.groups,
          groupRects: state.groupRects,
          editorGroupRects: state.editorGroupRects,
          tracks: state.tracks,
          editorTracks: state.editorTracks,
          theme: state.theme,
          showGrid: state.showGrid,
          snapToGrid: state.snapToGrid,
          pianoKeysCount: state.pianoKeysCount,
          blockOpacity: state.blockOpacity,
          mouseSensitivity: state.mouseSensitivity,
          masterVolume: state.masterVolume,
          showGroupName: state.showGroupName,
          showBlockPitch: state.showBlockPitch,
          showBlockVolume: state.showBlockVolume,
          showBlockInstrument: state.showBlockInstrument,
          mobileControlMode: state.mobileControlMode,
          camera: state.camera,
          editorCamera: state.editorCamera,
          recordedEvents: state.recordedEvents,
          gameBlocks: state.gameBlocks,
          editorRunners: state.editorRunners,
        }),
      }
    ),
    {
      partialize: (state) => ({ 
        blocks: state.blocks, 
        groups: state.groups, 
        groupRects: state.groupRects, 
        editorGroupRects: state.editorGroupRects, 
        tracks: state.tracks, 
        editorTracks: state.editorTracks, 
        gameBlocks: state.gameBlocks 
      }),
      onSave: () => {
        if (typeof window !== 'undefined' && isLevelEditor()) {
          import('./useLevelEditorStore').then(({ useLevelEditorStore }) => {
            useLevelEditorStore.getState().commitHistory();
          });
        }
      },
      equality: (pastState, currentState) => {
        if (pastState.groups !== currentState.groups) {
          return false;
        }
        const checkTracksEq = (ptList: Track[], ctList: Track[]) => {
          if (ptList === ctList) return true;
          if (!ptList || !ctList) return false;
          if (ptList.length !== ctList.length) return false;
          for (let i = 0; i < ptList.length; i++) {
            const pt = ptList[i];
            const ct = ctList[i];
            if (pt === ct) continue;
            if (pt.id !== ct.id || pt.name !== ct.name || pt.bpm !== ct.bpm ||
                pt.loop !== ct.loop || pt.enabled !== ct.enabled) return false;
            if (pt.nodes.length !== ct.nodes.length) return false;
            for (let j = 0; j < pt.nodes.length; j++) {
              const pn = pt.nodes[j];
              const cn = ct.nodes[j];
              if (pn === cn) continue;
              if (pn.id !== cn.id || pn.x !== cn.x || pn.y !== cn.y) return false;
            }
          }
          return true;
        };
        if (!checkTracksEq(pastState.tracks, currentState.tracks)) return false;
        if (!checkTracksEq(pastState.editorTracks, currentState.editorTracks)) return false;
        
        const checkGroupRectsEq = (pgList: GroupRect[], cgList: GroupRect[]) => {
          if (pgList === cgList) return true;
          if (!pgList || !cgList) return false;
          if (pgList.length !== cgList.length) return false;
          for (let i = 0; i < pgList.length; i++) {
            const pg = pgList[i];
            const cg = cgList[i];
            if (pg === cg) continue;
            if (pg.id !== cg.id || pg.name !== cg.name || pg.x !== cg.x || pg.y !== cg.y ||
                pg.w !== cg.w || pg.h !== cg.h || pg.volume !== cg.volume || pg.keyBinding !== cg.keyBinding || pg.enabled !== cg.enabled) {
              return false;
            }
          }
          return true;
        };
        if (!checkGroupRectsEq(pastState.groupRects, currentState.groupRects)) return false;
        if (!checkGroupRectsEq(pastState.editorGroupRects, currentState.editorGroupRects)) return false;

        if (pastState.blocks === currentState.blocks) return true;
        if (pastState.blocks.length !== currentState.blocks.length) return false;
        for (let i = 0; i < pastState.blocks.length; i++) {
          const pb = pastState.blocks[i] as Block;
          const cb = currentState.blocks[i] as Block;
          if (pb === cb) continue;
          if (pb.id !== cb.id || pb.x !== cb.x || pb.y !== cb.y || pb.pitch !== cb.pitch ||
            pb.volume !== cb.volume ||
            pb.instrument !== cb.instrument || pb.keyBinding !== cb.keyBinding ||
            pb.groupId !== cb.groupId) {
            return false;
          }
        }
        if (pastState.gameBlocks !== currentState.gameBlocks) {
          if (pastState.gameBlocks.length !== currentState.gameBlocks.length) return false;
          for (let i = 0; i < pastState.gameBlocks.length; i++) {
            const pb = pastState.gameBlocks[i] as Block;
            const cb = currentState.gameBlocks[i] as Block;
            if (pb === cb) continue;
            if (pb.id !== cb.id || pb.x !== cb.x || pb.y !== cb.y || pb.pitch !== cb.pitch ||
              pb.volume !== cb.volume ||
              pb.instrument !== cb.instrument || pb.keyBinding !== cb.keyBinding ||
              pb.groupId !== cb.groupId) {
              return false;
            }
          }
        }

        return true;
      }
    }
  )
);

export const undoAction = () => {
  const temporal = useStore.temporal.getState();
  if (temporal.pastStates.length === 0) {
    useStore.getState().showToast('Nothing to undo');
    return;
  }
  const past = temporal.pastStates[temporal.pastStates.length - 1];
  const current = useStore.getState();

  let msg = 'Undo: Modify Object';
  if ((past.blocks?.length || 0) < (current.blocks?.length || 0)) msg = 'Undo: Add Note';
  else if ((past.blocks?.length || 0) > (current.blocks?.length || 0)) msg = 'Undo: Delete Note';
  else if ((past.groupRects?.length || 0) < (current.groupRects?.length || 0) || (past.editorGroupRects?.length || 0) < (current.editorGroupRects?.length || 0)) msg = 'Undo: Add Group';
  else if ((past.groupRects?.length || 0) > (current.groupRects?.length || 0) || (past.editorGroupRects?.length || 0) > (current.editorGroupRects?.length || 0)) msg = 'Undo: Delete Group';
  else if ((past.tracks?.length || 0) < (current.tracks?.length || 0) || (past.editorTracks?.length || 0) < (current.editorTracks?.length || 0)) msg = 'Undo: Add Track';
  else if ((past.tracks?.length || 0) > (current.tracks?.length || 0) || (past.editorTracks?.length || 0) > (current.editorTracks?.length || 0)) msg = 'Undo: Delete Track';

  temporal.undo();
  useStore.getState().showToast(msg);
};

export const redoAction = () => {
  const temporal = useStore.temporal.getState();
  if (temporal.futureStates.length === 0) {
    useStore.getState().showToast('Nothing to redo');
    return;
  }
  const future = temporal.futureStates[temporal.futureStates.length - 1];
  const current = useStore.getState();
  
  let msg = 'Redo: Modify Object';
  if ((future.blocks?.length || 0) > (current.blocks?.length || 0)) msg = 'Redo: Add Note';
  else if ((future.blocks?.length || 0) < (current.blocks?.length || 0)) msg = 'Redo: Delete Note';
  else if ((future.groupRects?.length || 0) > (current.groupRects?.length || 0) || (future.editorGroupRects?.length || 0) > (current.editorGroupRects?.length || 0)) msg = 'Redo: Add Group';
  else if ((future.groupRects?.length || 0) < (current.groupRects?.length || 0) || (future.editorGroupRects?.length || 0) < (current.editorGroupRects?.length || 0)) msg = 'Redo: Delete Group';
  else if ((future.tracks?.length || 0) > (current.tracks?.length || 0) || (future.editorTracks?.length || 0) > (current.editorTracks?.length || 0)) msg = 'Redo: Add Track';
  else if ((future.tracks?.length || 0) < (current.tracks?.length || 0) || (future.editorTracks?.length || 0) < (current.editorTracks?.length || 0)) msg = 'Redo: Delete Track';

  temporal.redo();
  useStore.getState().showToast(msg);
};
