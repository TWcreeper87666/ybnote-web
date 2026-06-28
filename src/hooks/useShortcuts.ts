import { useEffect } from "react";
import { useStore, undoAction, redoAction } from "../store/useStore";
import { useGameStore } from "../store/useGameStore";
import { useLevelEditorStore } from "../store/useLevelEditorStore";
import type { CanvasContextType } from "../components/canvas/CanvasContext";
import { inputManager } from "../inputs/InputManager";

export const useShortcuts = (context: CanvasContextType = "playground") => {
  useEffect(() => {
    const handleKeyDown = (_code: string, e: KeyboardEvent) => {
      const key = e.key;
      let state = useStore.getState();

      // Disable shortcuts during active gameplay
      if (useGameStore.getState().gamePhase === "play") return;

      // Update interaction context if hovering over pocket canvas
      const isHoveringPocket =
        document.querySelector(".pocket-canvas-container:hover") !== null;
      if (isHoveringPocket && state.interactionContext !== "pocket") {
        useStore.getState().setInteractionContext("pocket");
        state = useStore.getState();
      }

      // Disable canvas shortcuts if we are in the level editor's pianoroll tab
      if (
        context === "editor" &&
        useLevelEditorStore.getState().activeTab === "pianoroll"
      ) {
        return;
      }

      // Check if user is typing in an input field
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        if (e.ctrlKey && key.toLowerCase() === "f") {
          e.preventDefault();
          state.toggleOutliner();
          if (!state.isOutlinerOpen) {
            setTimeout(() => {
              const searchInput = document.getElementById(
                "outliner-search-input",
              ) as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }, 50);
          }
          return;
        }
        return;
      }

      // For editor/game context, canvas operations go to the respective store
      const canvasState =
        context === "editor"
          ? useLevelEditorStore.getState()
          : context === "game"
            ? useGameStore.getState()
            : state;

      // Hotkey Note Triggering
      const blocksWithKey = canvasState.blocks.filter(
        (b) => b.keyBinding && b.keyBinding.toLowerCase() === key.toLowerCase(),
      );
      if (blocksWithKey.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        canvasState.updateBlocks(
          blocksWithKey.map((b) => {
            const containingRect = canvasState.groupRects.find(g =>
              g.enabled !== false &&
              b.x < g.x + g.w && b.x + 60 > g.x && b.y < g.y + g.h && b.y + 60 > g.y
            );
            return {
              id: b.id,
              updates: {
                playedAt: Date.now(),
                playedVolumeMultiplier: containingRect?.volume ?? 1,
                playedPitchOffset: containingRect?.pitchOffset ?? 0,
              },
            };
          }),
        );
      }

      // Hotkey GroupRect Triggering
      const groupsWithKey = canvasState.groupRects.filter(
        (g) =>
          g.enabled !== false &&
          g.keyBinding &&
          g.keyBinding.toLowerCase() === key.toLowerCase(),
      );
      if (groupsWithKey.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        groupsWithKey.forEach((g) => {
          canvasState.updateGroupRect(g.id, { playedAt: Date.now() });

          const isInside = (bx: number, by: number, bw: number, bh: number) => {
            return (
              bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y
            );
          };

          const blocksInside = canvasState.blocks.filter((b) =>
            isInside(b.x, b.y, 60, 60),
          );
          if (blocksInside.length > 0) {
            canvasState.updateBlocks(
              blocksInside.map((b) => ({
                id: b.id,
                updates: {
                  playedAt: Date.now(),
                  playedVolumeMultiplier: g.volume ?? 1,
                  playedPitchOffset: g.pitchOffset ?? 0,
                },
              })),
            );
          }
        });
      }

      // Editor Shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (key.toLowerCase()) {
          case "c":
            if (useGameStore.getState().gamePhase === "arrange") return;
            e.preventDefault();
            canvasState.copySelected();
            break;
          case "v":
            if (useGameStore.getState().gamePhase === "arrange") return;
            e.preventDefault();
            canvasState.pasteClipboard();
            break;
          case "d":
            if (useGameStore.getState().gamePhase === "arrange") return;
            e.preventDefault();
            canvasState.duplicateSelected();
            break;
          case "a":
            e.preventDefault();
            if (state.interactionContext === "pocket") {
              state.selectAllPocketBlocks();
            } else {
              if (e.shiftKey) {
                canvasState.selectAllBlocks();
              } else {
                canvasState.selectAll();
              }
            }
            break;
          case "g":
            e.preventDefault();
            if (e.shiftKey) {
              canvasState.ungroupSelected();
              if (context === "game") useGameStore.getState().commitHistory();
              if (context !== "playground")
                state.showToast("已解散群組 (Group Dissolved)");
            } else {
              canvasState.groupSelected();
              if (context === "game") useGameStore.getState().commitHistory();
              if (context !== "playground")
                state.showToast("已建立群組 (Group Created)");
            }
            break;
          case "f":
            e.preventDefault();
            state.toggleOutliner();
            if (!state.isOutlinerOpen) {
              setTimeout(() => {
                const searchInput = document.getElementById(
                  "outliner-search-input",
                ) as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }, 50);
            }
            break;
          case "z":
            e.preventDefault();
            if (context === "editor") {
              if (e.shiftKey) {
                useLevelEditorStore.getState().redo();
              } else {
                useLevelEditorStore.getState().undo();
              }
            } else if (context === "game") {
              const gs = useGameStore.getState();
              if (e.shiftKey) {
                if (gs.historyIndex >= gs.history.length - 1) {
                  state.showToast("Nothing to redo");
                } else {
                  gs.redo();
                  state.showToast("Redo");
                }
              } else {
                if (gs.historyIndex <= 0) {
                  state.showToast("Nothing to undo");
                } else {
                  gs.undo();
                  state.showToast("Undo");
                }
              }
            } else {
              if (e.shiftKey) {
                redoAction();
              } else {
                undoAction();
              }
            }
            break;
          case "y":
            e.preventDefault();
            if (context === "editor") {
              useLevelEditorStore.getState().redo();
            } else if (context === "game") {
              const gs = useGameStore.getState();
              if (gs.historyIndex >= gs.history.length - 1) {
                state.showToast("Nothing to redo");
              } else {
                gs.redo();
                state.showToast("Redo");
              }
            } else {
              redoAction();
            }
            break;
        }
      } else {
        if (["1", "2", "3", "4", "5"].includes(key)) {
          const keyToMode: Record<
            string,
            "select" | "piano" | "drum" | "draw_group" | "draw_track" | "play"
          > = {
            "1": "piano",
            "2": "drum",
            "3": "draw_group",
            "4": "draw_track",
            "5": "play",
          };
          const targetMode = keyToMode[key];
          if (state.mode === targetMode) {
            state.setMode("select");
          } else {
            state.setMode(targetMode);
          }
          return;
        }

        if (key === "Delete" || key === "Backspace") {
          if (useGameStore.getState().gamePhase === "arrange") return;
          if (context !== "editor" && state.activeTrackId) {
            state.deleteTrack(state.activeTrackId);
            state.setActiveTrackId(null);
          }
          if (
            canvasState.selectedBlockIds.length > 0 ||
            canvasState.selectedTrackIds.length > 0 ||
            canvasState.selectedGroupRectIds.length > 0
          ) {
            canvasState.deleteSelected();
          }
        } else if (key === "Escape") {
          if (state.interactionContext === "pocket") {
            state.clearPocketSelection();
          } else if (state.mode !== "select") {
            state.setMode("select");
          } else {
            canvasState.clearSelection();
          }
        }
      }
    };

    inputManager.on("keydown", handleKeyDown);
    return () => inputManager.off("keydown", handleKeyDown);
  }, []);
};
