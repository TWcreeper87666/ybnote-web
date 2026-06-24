// hooks/usePlayInteraction.ts
import { useEffect, useCallback } from "react";
import { useStore } from "../store/useStore";
import { isLevelEditor } from "../utils/routeUtils";
import { lineIntersectsRect } from "../utils/geometry";
import { shiftPitch } from "../utils/pitchUtils";

export function useTrailIntersection(intersectedBlocksRef: React.RefObject<Set<string>>) {
  return useCallback(
    (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      isFirstPoint = false,
      startedOnBlock = false,
    ) => {
      const state = useStore.getState();
      const blocksList = isLevelEditor() ? state.gameBlocks : state.blocks;
      const groupRects = state.groupRects;

      const currentFrameIntersected = new Set<string>();

      blocksList.forEach((b) => {
        if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
          currentFrameIntersected.add(b.id);
          if (!intersectedBlocksRef.current.has(b.id)) {
            state.updateBlock(b.id, {
              playedAt: Date.now(),
              playedVolumeMultiplier: 1,
            });
          }
        }
      });

      groupRects.forEach((g) => {
        if (g.enabled === false) return;
        if (lineIntersectsRect(x1, y1, x2, y2, g.x, g.y, g.w, g.h)) {
          currentFrameIntersected.add(`groupRect:${g.id}`);
          if (!intersectedBlocksRef.current.has(`groupRect:${g.id}`)) {
            if (isFirstPoint && startedOnBlock) {
              // 只標記已訪問，不觸發
            } else {
              state.updateGroupRect(g.id, { playedAt: Date.now() });

              const isInside = (bx: number, by: number, bw: number, bh: number) =>
                bx < g.x + g.w && bx + bw > g.x && by < g.y + g.h && by + bh > g.y;

              const blocksInside = blocksList.filter((b) => isInside(b.x, b.y, 60, 60));
              if (blocksInside.length > 0) {
                state.updateBlocks(
                  blocksInside.map((b) => ({
                    id: b.id,
                    updates: {
                      playedAt: Date.now(),
                      playedVolumeMultiplier: g.volume ?? 1,
                    },
                  })),
                );
              }
            }
          }
        }
      });

      intersectedBlocksRef.current = currentFrameIntersected;
    },
    [intersectedBlocksRef],
  );
}

export function usePlayInteraction(
  mode: string,
  checkTrailIntersection: ReturnType<typeof useTrailIntersection>,
  intersectedBlocksRef: React.RefObject<Set<string>>,
) {
  // 進出 pointer lock
  useEffect(() => {
    if (mode === "play") {
      document.body.requestPointerLock().catch((err) => {
        console.error("Pointer lock failed", err);
      });
    } else if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [mode]);

  // pointer lock 被瀏覽器強制解除時，退出 play mode
  useEffect(() => {
    const handlePointerLockChange = () => {
      if (
        document.pointerLockElement !== document.body &&
        useStore.getState().mode === "play"
      ) {
        useStore.getState().setMode("select");
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () =>
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
  }, []);

  // 滑鼠移動 → 控制鏡頭 + trail 偵測
  useEffect(() => {
    if (mode !== "play") return;
    let rafId: number | null = null;
    let pendingMovementX = 0;
    let pendingMovementY = 0;
    let buttonsPressed = 0;

    const handleMouseMove = (e: MouseEvent) => {
      pendingMovementX += e.movementX;
      pendingMovementY += e.movementY;
      buttonsPressed = e.buttons;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          const state = useStore.getState();
          const newCamX = state.camera.x - pendingMovementX * state.mouseSensitivity;
          const newCamY = state.camera.y - pendingMovementY * state.mouseSensitivity;

          if (buttonsPressed > 0) {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            const oldLocalX = (centerX - state.camera.x) / state.camera.zoom;
            const oldLocalY = (centerY - state.camera.y) / state.camera.zoom;
            const newLocalX = (centerX - newCamX) / state.camera.zoom;
            const newLocalY = (centerY - newCamY) / state.camera.zoom;

            checkTrailIntersection(oldLocalX, oldLocalY, newLocalX, newLocalY, false, false);
          }

          state.updateCamera({ x: newCamX, y: newCamY });

          pendingMovementX = 0;
          pendingMovementY = 0;
          buttonsPressed = 0;
          rafId = null;
        });
      }
    };

    const handleMouseDown = () => {
      const state = useStore.getState();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const localX = (centerX - state.camera.x) / state.camera.zoom;
      const localY = (centerY - state.camera.y) / state.camera.zoom;

      let startedOnBlock = false;
      const targetBlocks = isLevelEditor() ? state.gameBlocks : state.blocks;
      for (const b of targetBlocks) {
        if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) {
          startedOnBlock = true;
          break;
        }
      }

      intersectedBlocksRef.current.clear();
      checkTrailIntersection(localX, localY, localX, localY, true, startedOnBlock);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.buttons === 0) {
        intersectedBlocksRef.current.clear();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mode, checkTrailIntersection, intersectedBlocksRef]);
}

// wheel 攔截（pitch / volume 調整），給 useCanvasCamera 用
export function useWheelIntercept() {
  return useCallback((e: WheelEvent) => {
    const state = useStore.getState();
    let targetBlockId = state.hoveredBlockId;
    let targetGroupRectId = state.hoveredGroupRectId;

    if (state.mode === "play") {
      targetBlockId = null;
      targetGroupRectId = null;
    } else if (!targetBlockId && !targetGroupRectId) {
      const globalX = e.clientX;
      const globalY = e.clientY;
      const localX = (globalX - state.camera.x) / state.camera.zoom;
      const localY = (globalY - state.camera.y) / state.camera.zoom;

      const targetBlocks = isLevelEditor() ? state.gameBlocks : state.blocks;
      for (let i = targetBlocks.length - 1; i >= 0; i--) {
        const b = targetBlocks[i];
        if (localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60) {
          targetBlockId = b.id;
          break;
        }
      }

      if (!targetBlockId) {
        for (let i = state.groupRects.length - 1; i >= 0; i--) {
          const g = state.groupRects[i];
          if (localX >= g.x && localX <= g.x + g.w && localY >= g.y && localY <= g.y + g.h) {
            targetGroupRectId = g.id;
            break;
          }
        }
      }
    }

    if (targetBlockId && !e.ctrlKey) {
      e.preventDefault();
      const isVolume = e.shiftKey;
      const delta = e.deltaY > 0 ? -1 : 1;

      state.mutateBlocks(
        [targetBlockId as string],
        (b) => {
          if (isVolume) {
            const newVolume =
              Math.round(Math.max(0, Math.min(1, (b.volume ?? 1) + delta * 0.1)) * 100) / 100;
            return { volume: newVolume, playedAt: Date.now(), playedVolumeMultiplier: 1 };
          } else {
            const newPitch = shiftPitch(b.pitch, delta);
            return { pitch: newPitch, playedAt: Date.now(), playedVolumeMultiplier: 1 };
          }
        },
        { continuous: true },
      );
      return true;
    } else if (targetGroupRectId && !e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const rect = state.groupRects.find((g) => g.id === targetGroupRectId);
      if (rect) {
        const newVolume =
          Math.round(Math.max(0, Math.min(1, (rect.volume ?? 1) + delta * 0.1)) * 100) / 100;
        state.updateGroupRect(rect.id, { volume: newVolume });
      }
      return true;
    }
    return false;
  }, []);
}