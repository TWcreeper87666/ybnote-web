import { useEffect, useContext } from 'react';
import { useStore, undoAction, redoAction } from '../store/useStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { CanvasStoreContext } from '../store/CanvasStoreContext';

/** Shared shortcuts for all scenarios (Playground, Editor, Game) */
export const useShortcuts = () => {
  const canvasStoreCtx = useContext(CanvasStoreContext);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const globalState = useStore.getState();

      // Disable shortcuts during active gameplay
      if (globalState.gameState === 'play') return;

      // Canvas state (blocks, groups, mode) — prefer context store if available
      const cs = canvasStoreCtx ? (canvasStoreCtx.getState() as any) : globalState;

      // Update interaction context if hovering over pocket canvas
      const isHoveringPocket = document.querySelector('.pocket-canvas-container:hover') !== null;
      if (isHoveringPocket && globalState.interactionContext !== 'pocket') {
        globalState.setInteractionContext('pocket');
      }

      // Check if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          globalState.toggleOutliner();
          if (!globalState.isOutlinerOpen) {
            setTimeout(() => {
              const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }, 50);
          }
          return;
        }
        return;
      }

      // Hotkey Note Triggering — use canvas context store blocks
      const blocks = cs.blocks ?? [];
      const groupRects = cs.groupRects ?? [];
      const blocksWithKey = blocks.filter((b: any) => b.keyBinding && b.keyBinding.toLowerCase() === e.key.toLowerCase());
      if (blocksWithKey.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        cs.updateBlocks?.(blocksWithKey.map((b: any) => ({ id: b.id, updates: { playedAt: Date.now(), playedVolumeMultiplier: 1 } })));
      }

      // Hotkey GroupRect Triggering — use canvas context store
      const groupsWithKey = groupRects.filter((g: any) => g.enabled !== false && g.keyBinding && g.keyBinding.toLowerCase() === e.key.toLowerCase());
      if (groupsWithKey.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        groupsWithKey.forEach((g: any) => {
          cs.updateGroupRect?.(g.id, { playedAt: Date.now() });

          const isInside = (bx: number, by: number, bw: number, bh: number) => {
            return bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;
          };

          const blocksInside = blocks.filter((b: any) => isInside(b.x, b.y, 60, 60));
          if (blocksInside.length > 0) {
            cs.updateBlocks?.(blocksInside.map((b: any) => ({
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
            if (globalState.gameState === 'arrange') return;
            e.preventDefault();
            cs.copySelected?.();
            break;
          case 'v':
            if (globalState.gameState === 'arrange') return;
            e.preventDefault();
            cs.pasteClipboard?.();
            break;
          case 'd':
            if (globalState.gameState === 'arrange') return;
            e.preventDefault();
            cs.duplicateSelected?.();
            break;
          case 'a':
            e.preventDefault();
            if (globalState.interactionContext === 'pocket') {
              globalState.selectAllPocketBlocks();
            } else {
              if (e.shiftKey) {
                cs.selectAllBlocks?.();
              } else {
                cs.selectAll?.();
              }
            }
            break;
          case 'g':
            e.preventDefault();
            if (e.shiftKey) {
              cs.ungroupSelected?.();
            } else {
              cs.groupSelected?.();
            }
            break;
          case 'f':
            e.preventDefault();
            globalState.toggleOutliner();
            if (!globalState.isOutlinerOpen) {
              setTimeout(() => {
                const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }, 50);
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redoAction();
            } else {
              undoAction();
            }
            break;
          case 'y':
            e.preventDefault();
            redoAction();
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
          const currentMode = cs.mode ?? globalState.mode;
          if (currentMode === targetMode) {
            cs.setMode?.('select');
          } else {
            cs.setMode?.(targetMode);
          }
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (globalState.gameState === 'arrange') return;
          const activeTrackId = cs.activeTrackId ?? globalState.activeTrackId;
          if (activeTrackId) {
            cs.deleteTrack?.(activeTrackId);
            cs.setActiveTrackId?.(null);
          }
          if ((cs.selectedBlockIds?.length > 0) || (cs.selectedTrackIds?.length > 0) || (cs.selectedGroupRectIds?.length > 0)) {
            cs.deleteSelected?.();
          }
        } else if (e.key === 'Escape') {
          if (globalState.interactionContext === 'pocket') {
            globalState.clearPocketSelection();
          } else if ((cs.mode ?? globalState.mode) !== 'select') {
            cs.setMode?.('select');
          } else {
            cs.clearSelection?.();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasStoreCtx]);
};

/**
 * Level Editor-specific shortcuts
 * Handles: pianoroll tab disabling, editor-focused undo/redo
 */
export const useLevelEditorShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const editorState = useLevelEditorStore.getState();

      // Disable canvas shortcuts if in pianoroll tab
      if (editorState.activeTab === 'pianoroll') {
        return;
      }

      // Editor-specific undo/redo routing (override useShortcuts)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            e.stopImmediatePropagation();
            if (e.shiftKey) {
              editorState.redo();
            } else {
              editorState.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            e.stopImmediatePropagation();
            editorState.redo();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
