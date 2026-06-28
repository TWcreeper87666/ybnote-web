import { useEffect, useRef } from "react";
import { inputManager } from "../inputs/InputManager";
import { useGameStore } from "../store/useGameStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { clampZoom } from "../utils/canvasUtils";

interface UsePlayModeInputProps {
  gamePhase: string;
  isMobile: boolean;
  startTrail: (x: number, y: number) => void;
  updateTrail: (
    x: number,
    y: number,
    callback: (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
    ) => void,
  ) => void;
  endTrail: () => void;
  checkTrailIntersection: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => void;
  intersectedBlocksRef: React.MutableRefObject<Set<string>>;
}

export const usePlayModeInput = ({
  gamePhase,
  isMobile,
  startTrail,
  updateTrail,
  endTrail,
  checkTrailIntersection,
  intersectedBlocksRef,
}: UsePlayModeInputProps) => {
  // 💡 核心解法：用 useRef 儲存最新的回呼函式，避免 60FPS 渲染導致 useEffect 瘋狂重置
  const callbacksRef = useRef({
    startTrail,
    updateTrail,
    endTrail,
    checkTrailIntersection,
  });
  useEffect(() => {
    callbacksRef.current = {
      startTrail,
      updateTrail,
      endTrail,
      checkTrailIntersection,
    };
  }, [startTrail, updateTrail, endTrail, checkTrailIntersection]);

  useEffect(() => {
    if (gamePhase !== "play") return;

    const currentMode = useSettingsStore.getState().mobileControlMode;

    if (!isMobile && currentMode === "crosshair") {
      document.body
        .requestPointerLock()
        .catch((err) => console.error("Pointer lock failed", err));
    }

    let rafId: number | null = null;
    let pendingMovementX = 0;
    let pendingMovementY = 0;
    let buttonsPressed = 0;
    let keysDown = 0;

    // 追蹤滑鼠懸停位置 (為了讓鍵盤打擊能抓到正確的游標座標)
    let lastHoverPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    let leftTouchId: number | null = null;
    let rightTouchId: number | null = null;
    let lastRightTouchPos: { x: number; y: number } | null = null;
    let playPinchDist = 0;
    let playInitZoom = 1;
    let playInitLocalX = 0;
    let playInitLocalY = 0;

    const getActivePointers = () => inputManager.getPointers();

    const triggerAttackCenter = () => {
      const gc = useGameStore.getState().camera;
      const workspace = document.querySelector(".le-workspace");
      const rect = workspace
        ? workspace.getBoundingClientRect()
        : {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const localX = (centerX - gc.x) / gc.zoom;
      const localY = (centerY - gc.y) / gc.zoom;

      callbacksRef.current.startTrail(localX, localY);
      intersectedBlocksRef.current.clear();
      callbacksRef.current.checkTrailIntersection(
        localX,
        localY,
        localX,
        localY,
      );
    };

    const triggerAttackAt = (clientX: number, clientY: number) => {
      const gc = useGameStore.getState().camera;
      const workspace = document.querySelector(".le-workspace");
      const rect = workspace
        ? workspace.getBoundingClientRect()
        : { left: 0, top: 0 };
      const localX = (clientX - rect.left - gc.x) / gc.zoom;
      const localY = (clientY - rect.top - gc.y) / gc.zoom;

      callbacksRef.current.startTrail(localX, localY);
      intersectedBlocksRef.current.clear();
      callbacksRef.current.checkTrailIntersection(
        localX,
        localY,
        localX,
        localY,
      );
    };

    const applyMovement = () => {
      const gs = useGameStore.getState();
      const { mouseSensitivity, mobileControlMode } =
        useSettingsStore.getState();
      const newCamX =
        gs.camera.x -
        pendingMovementX * (isMobile ? mouseSensitivity * 2 : mouseSensitivity);
      const newCamY =
        gs.camera.y -
        pendingMovementY * (isMobile ? mouseSensitivity * 2 : mouseSensitivity);

      if (
        (buttonsPressed > 0 || keysDown > 0) &&
        mobileControlMode === "crosshair" &&
        (pendingMovementX !== 0 || pendingMovementY !== 0)
      ) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const newLocalX = (centerX - newCamX) / gs.camera.zoom;
        const newLocalY = (centerY - newCamY) / gs.camera.zoom;
        callbacksRef.current.updateTrail(newLocalX, newLocalY, (p1, p2) =>
          callbacksRef.current.checkTrailIntersection(p1.x, p1.y, p2.x, p2.y),
        );
      }

      useGameStore.getState().updateCamera({ x: newCamX, y: newCamY });
      pendingMovementX = 0;
      pendingMovementY = 0;
      if (!isMobile) buttonsPressed = 0;
      rafId = null;
    };

    const onGlobalPointerDown = (e: PointerEvent) => {
      const isCanvas =
        (e.target as HTMLElement)?.tagName?.toLowerCase() === "canvas";
      if (!isCanvas && e.pointerType === "touch") return;

      const mode = useSettingsStore.getState().mobileControlMode;
      const gc = useGameStore.getState().camera;
      const workspace = document.querySelector(".le-workspace");
      const rect = workspace
        ? workspace.getBoundingClientRect()
        : {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };

      if (!isMobile && e.pointerType === "mouse") {
        if (mode === "crosshair") triggerAttackCenter();
        else triggerAttackAt(e.clientX, e.clientY);
      } else {
        const pointers = getActivePointers();
        if (mode === "crosshair") {
          if (e.clientX < window.innerWidth / 2) {
            if (leftTouchId === null) {
              leftTouchId = e.pointerId;
              buttonsPressed = 1;
              triggerAttackCenter();
            }
          } else {
            if (rightTouchId === null) {
              rightTouchId = e.pointerId;
              lastRightTouchPos = { x: e.clientX, y: e.clientY };
            }
          }
          const rightPointers = pointers.filter(
            (p) => p.x >= window.innerWidth / 2,
          );
          if (rightPointers.length >= 2 && playPinchDist === 0) {
            playPinchDist = Math.hypot(
              rightPointers[0].x - rightPointers[1].x,
              rightPointers[0].y - rightPointers[1].y,
            );
            playInitZoom = gc.zoom;
            const centerX = (rightPointers[0].x + rightPointers[1].x) / 2;
            const centerY = (rightPointers[0].y + rightPointers[1].y) / 2;
            playInitLocalX = (centerX - rect.left - gc.x) / gc.zoom;
            playInitLocalY = (centerY - rect.top - gc.y) / gc.zoom;
          }
        } else {
          if (pointers.length === 1) {
            if (leftTouchId === null) {
              leftTouchId = e.pointerId;
              triggerAttackAt(e.clientX, e.clientY);
            }
          } else if (pointers.length >= 2) {
            if (leftTouchId !== null) {
              callbacksRef.current.endTrail();
              leftTouchId = null;
            }
            playPinchDist = Math.hypot(
              pointers[0].x - pointers[1].x,
              pointers[0].y - pointers[1].y,
            );
            playInitZoom = gc.zoom;
            const centerX = (pointers[0].x + pointers[1].x) / 2;
            const centerY = (pointers[0].y + pointers[1].y) / 2;
            playInitLocalX = (centerX - rect.left - gc.x) / gc.zoom;
            playInitLocalY = (centerY - rect.top - gc.y) / gc.zoom;
          }
        }
      }
    };

    const onGlobalPointerMove = (e: PointerEvent) => {
      const isCanvas =
        (e.target as HTMLElement)?.tagName?.toLowerCase() === "canvas";
      if (!isCanvas && e.pointerType === "touch") return;
      if (e.cancelable && e.pointerType === "touch") e.preventDefault();

      const mode = useSettingsStore.getState().mobileControlMode;
      const gc = useGameStore.getState().camera;
      const workspace = document.querySelector(".le-workspace");
      const rect = workspace
        ? workspace.getBoundingClientRect()
        : { left: 0, top: 0 };

      if (!isMobile && e.pointerType === "mouse") {
        lastHoverPos = { x: e.clientX, y: e.clientY }; // 更新懸停位置

        if (mode === "crosshair") {
          pendingMovementX += e.movementX;
          pendingMovementY += e.movementY;
          buttonsPressed = e.buttons;
          if (!rafId) rafId = requestAnimationFrame(applyMovement);
        } else if (e.buttons > 0 || keysDown > 0) {
          // 👈 修復：把 || keysDown > 0 加在這裡！
          // 只要滑鼠左鍵「或」鍵盤任意鍵被按住，移動滑鼠就會持續更新打擊軌跡
          const localX = (e.clientX - rect.left - gc.x) / gc.zoom;
          const localY = (e.clientY - rect.top - gc.y) / gc.zoom;
          callbacksRef.current.updateTrail(localX, localY, (p1, p2) =>
            callbacksRef.current.checkTrailIntersection(p1.x, p1.y, p2.x, p2.y),
          );
        }
      } else {
        // 👇 手機觸控邏輯 (清掉剛剛多餘的 else if 分支)
        const pointers = getActivePointers();
        if (mode === "crosshair") {
          const rightPointers = pointers.filter(
            (p) => p.x >= window.innerWidth / 2,
          );
          if (rightPointers.length >= 2 && playPinchDist > 0) {
            const dist = Math.hypot(
              rightPointers[0].x - rightPointers[1].x,
              rightPointers[0].y - rightPointers[1].y,
            );
            const zoomFactor = dist / playPinchDist;
            const newZoom = clampZoom(playInitZoom * zoomFactor);
            const centerX = (rightPointers[0].x + rightPointers[1].x) / 2;
            const centerY = (rightPointers[0].y + rightPointers[1].y) / 2;
            const newCamX = centerX - rect.left - playInitLocalX * newZoom;
            const newCamY = centerY - rect.top - playInitLocalY * newZoom;
            useGameStore
              .getState()
              .updateCamera({ zoom: newZoom, x: newCamX, y: newCamY });
            lastRightTouchPos = null;
          } else if (e.pointerId === rightTouchId && lastRightTouchPos) {
            pendingMovementX += e.clientX - lastRightTouchPos.x;
            pendingMovementY += e.clientY - lastRightTouchPos.y;
            lastRightTouchPos = { x: e.clientX, y: e.clientY };
            if (!rafId) rafId = requestAnimationFrame(applyMovement);
          }
        } else {
          if (pointers.length >= 2 && playPinchDist > 0) {
            const dist = Math.hypot(
              pointers[0].x - pointers[1].x,
              pointers[0].y - pointers[1].y,
            );
            const zoomFactor = dist / playPinchDist;
            const newZoom = clampZoom(playInitZoom * zoomFactor);
            const centerX = (pointers[0].x + pointers[1].x) / 2;
            const centerY = (pointers[0].y + pointers[1].y) / 2;
            const newCamX = centerX - rect.left - playInitLocalX * newZoom;
            const newCamY = centerY - rect.top - playInitLocalY * newZoom;
            useGameStore
              .getState()
              .updateCamera({ zoom: newZoom, x: newCamX, y: newCamY });
          } else if (e.pointerId === leftTouchId) {
            const localX = (e.clientX - rect.left - gc.x) / gc.zoom;
            const localY = (e.clientY - rect.top - gc.y) / gc.zoom;
            callbacksRef.current.updateTrail(localX, localY, (p1, p2) =>
              callbacksRef.current.checkTrailIntersection(
                p1.x,
                p1.y,
                p2.x,
                p2.y,
              ),
            );
          }
        }
      }
    };

    const onGlobalPointerUp = (e: PointerEvent) => {
      const mode = useSettingsStore.getState().mobileControlMode;

      if (!isMobile && e.pointerType === "mouse") {
        if (e.buttons === 0 && keysDown === 0) {
          intersectedBlocksRef.current.clear();
          callbacksRef.current.endTrail();
        }
      } else {
        if (mode === "crosshair") {
          if (e.pointerId === leftTouchId) {
            leftTouchId = null;
            buttonsPressed = 0;
            intersectedBlocksRef.current.clear();
            callbacksRef.current.endTrail();
          }
          if (e.pointerId === rightTouchId) {
            const remainingRight = getActivePointers().filter(
              (p) => p.x >= window.innerWidth / 2,
            );
            if (remainingRight.length > 0) {
              const nextPointerId = Array.from(
                inputManager.pointers.keys(),
              ).find((id) => {
                const pointer = inputManager.pointers.get(id);
                return pointer ? pointer.x >= window.innerWidth / 2 : false;
              });
              rightTouchId = nextPointerId ?? null;
              if (rightTouchId)
                lastRightTouchPos = {
                  x: inputManager.pointers.get(rightTouchId)!.x,
                  y: inputManager.pointers.get(rightTouchId)!.y,
                };
            } else {
              rightTouchId = null;
            }
          }
          if (
            getActivePointers().filter((p) => p.x >= window.innerWidth / 2)
              .length < 2
          ) {
            playPinchDist = 0;
          }
        } else {
          if (e.pointerId === leftTouchId) {
            leftTouchId = null;
            intersectedBlocksRef.current.clear();
            callbacksRef.current.endTrail();
          }
          const pointers = getActivePointers();
          if (pointers.length < 2) playPinchDist = 0;
          if (pointers.length === 1 && playPinchDist === 0) {
            const remainingId = Array.from(inputManager.pointers.keys())[0];
            leftTouchId = remainingId;
            const touchPos = inputManager.pointers.get(remainingId)!;
            triggerAttackAt(touchPos.x, touchPos.y);
          }
        }
      }
    };

    const onKeyDown = (key: string) => {
      if (key === "Escape") return;
      const mode = useSettingsStore.getState().mobileControlMode;

      // 確保長按時不會瘋狂觸發，只在按下的第一下打擊
      if (keysDown === 0) {
        if (mode === "crosshair") {
          triggerAttackCenter();
        } else {
          // 一般滑鼠模式支援 Z/X 連打 (抓取懸停位置)
          triggerAttackAt(lastHoverPos.x, lastHoverPos.y);
        }
      }
      keysDown++;
    };

    const onKeyUp = () => {
      keysDown = Math.max(0, keysDown - 1);
      if (keysDown === 0 && buttonsPressed === 0) {
        intersectedBlocksRef.current.clear();
        callbacksRef.current.endTrail();
      }
    };

    const unsubDown = inputManager.on("pointerdown", onGlobalPointerDown);
    const unsubMove = inputManager.on("pointermove", onGlobalPointerMove);
    const unsubUp = inputManager.on("pointerup", onGlobalPointerUp);
    const unsubKeyD = inputManager.on("keydown", onKeyDown);
    const unsubKeyU = inputManager.on("keyup", onKeyUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsubDown();
      unsubMove();
      unsubUp();
      unsubKeyD();
      unsubKeyU();
      if (!isMobile && document.pointerLockElement) document.exitPointerLock();
    };
  }, [gamePhase, isMobile, intersectedBlocksRef]); // 💡 依賴陣列極簡化：不再因重新渲染而重置綁定！
};
