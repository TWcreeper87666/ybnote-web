import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export const useShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useStore.getState();

      // Check if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.ctrlKey && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          state.toggleHierarchy();
          if (!state.isHierarchyOpen) {
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
        state.updateBlocks(blocksWithKey.map(b => ({ id: b.id, updates: { playedAt: Date.now() } })));
      }

      // Editor Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            state.copySelected();
            break;
          case 'v':
            e.preventDefault();
            state.pasteClipboard();
            break;
          case 'd':
            e.preventDefault();
            state.duplicateSelected();
            break;
          case 'a':
            e.preventDefault();
            if (e.shiftKey) {
              state.selectAllBlocks();
            } else {
              state.selectAll();
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
            state.toggleHierarchy();
            if (!state.isHierarchyOpen) {
              setTimeout(() => {
                const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }, 50);
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              useStore.temporal.getState().redo();
            } else {
              useStore.temporal.getState().undo();
            }
            break;
          case 'y':
            e.preventDefault();
            useStore.temporal.getState().redo();
            break;
        }
      } else {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (state.activeTrackId) {
            state.deleteTrack(state.activeTrackId);
            state.setActiveTrackId(null);
          }
          if (state.selectedBlockIds.length > 0 || state.selectedTrackIds.length > 0) {
            state.deleteSelected();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
