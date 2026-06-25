import { useEffect } from 'react';
import { useStore, undoAction, redoAction } from '../store/useStore';
import { useGameStore } from '../store/useGameStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import type { CanvasContextType } from '../components/canvas/CanvasContext';

export const useShortcuts = (context: CanvasContextType = 'playground') => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let state = useStore.getState();

      // Disable shortcuts during active gameplay
      if (useGameStore.getState().gamePhase === 'play') return;

      // Update interaction context if hovering over pocket canvas
      const isHoveringPocket = document.querySelector('.pocket-canvas-container:hover') !== null;
      if (isHoveringPocket && state.interactionContext !== 'pocket') {
        useStore.getState().setInteractionContext('pocket');
        state = useStore.getState();
      }

      // Disable canvas shortcuts if we are in the level editor's pianoroll tab
      if (context === 'editor' && useLevelEditorStore.getState().activeTab === 'pianoroll') {
        return;
      }

      // Check if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          state.toggleOutliner();
          if (!state.isOutlinerOpen) {
            setTimeout(() => {
              const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }, 50);
          }
          return;
        }
        return;
      }

      // Hotkey Note Triggering
      const blocksWithKey = state.blocks.filter(b => b.keyBinding && b.keyBinding.toLowerCase() === e.key.toLowerCase());
      if (blocksWithKey.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        state.updateBlocks(blocksWithKey.map(b => ({ id: b.id, updates: { playedAt: Date.now(), playedVolumeMultiplier: 1 } })));
      }

      // Hotkey GroupRect Triggering
      const groupsWithKey = state.groupRects.filter(g => g.enabled !== false && g.keyBinding && g.keyBinding.toLowerCase() === e.key.toLowerCase());
      if (groupsWithKey.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        groupsWithKey.forEach(g => {
          state.updateGroupRect(g.id, { playedAt: Date.now() });
          
          const isInside = (bx: number, by: number, bw: number, bh: number) => {
            return bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;
          };
          
          const blocksInside = state.blocks.filter(b => isInside(b.x, b.y, 60, 60));
          if (blocksInside.length > 0) {
            state.updateBlocks(blocksInside.map(b => ({
              id: b.id,
              updates: { playedAt: Date.now(), playedVolumeMultiplier: g.volume ?? 1 }
            })));
          }
        });
      }

      // Editor Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            if (useGameStore.getState().gamePhase === 'arrange') return;
            e.preventDefault();
            state.copySelected();
            break;
          case 'v':
            if (useGameStore.getState().gamePhase === 'arrange') return;
            e.preventDefault();
            state.pasteClipboard();
            break;
          case 'd':
            if (useGameStore.getState().gamePhase === 'arrange') return;
            e.preventDefault();
            state.duplicateSelected();
            break;
          case 'a':
            e.preventDefault();
            if (state.interactionContext === 'pocket') {
              state.selectAllPocketBlocks();
            } else {
              if (e.shiftKey) {
                state.selectAllBlocks();
              } else {
                state.selectAll();
              }
            }
            break;
          case 'g':
            e.preventDefault();
            if (e.shiftKey) {
              state.ungroupSelected();
            } else {
              state.groupSelected();
            }
            break;
          case 'f':
            e.preventDefault();
            state.toggleOutliner();
            if (!state.isOutlinerOpen) {
              setTimeout(() => {
                const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }, 50);
            }
            break;
          case 'z':
            e.preventDefault();
            if (context === 'editor') {
              if (e.shiftKey) {
                useLevelEditorStore.getState().redo();
              } else {
                useLevelEditorStore.getState().undo();
              }
            } else {
              if (e.shiftKey) {
                redoAction();
              } else {
                undoAction();
              }
            }
            break;
          case 'y':
            e.preventDefault();
            if (context === 'editor') {
              useLevelEditorStore.getState().redo();
            } else {
              redoAction();
            }
            break;
        }
      } else {
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
          const keyToMode: Record<string, 'select' | 'piano' | 'drum' | 'draw_group' | 'draw_track' | 'play'> = {
            '1': 'piano',
            '2': 'drum',
            '3': 'draw_group',
            '4': 'draw_track',
            '5': 'play'
          };
          const targetMode = keyToMode[e.key];
          if (state.mode === targetMode) {
            state.setMode('select');
          } else {
            state.setMode(targetMode);
          }
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (useGameStore.getState().gamePhase === 'arrange') return;
          if (state.activeTrackId) {
            state.deleteTrack(state.activeTrackId);
            state.setActiveTrackId(null);
          }
          if (state.selectedBlockIds.length > 0 || state.selectedTrackIds.length > 0 || state.selectedGroupRectIds.length > 0) {
            state.deleteSelected();
          }
        } else if (e.key === 'Escape') {
          if (state.interactionContext === 'pocket') {
            state.clearPocketSelection();
          } else if (state.mode !== 'select') {
            state.setMode('select');
          } else {
            state.clearSelection();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
