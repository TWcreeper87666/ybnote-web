import { useEffect, useRef } from "react";
import { inputManager } from "../inputs/InputManager";
import { useGameStore } from "../store/useGameStore";
import { useStore } from "../store/useStore";
import { clampZoom } from "../utils/canvasUtils";

interface UseArrangeModeInputProps {
  isMobile: boolean;
  startTrail: (x: number, y: number) => void;
  updateTrail: (x: number, y: number, callback: (p1: {x:number,y:number}, p2: {x:number,y:number}) => void) => void;
  checkTrailIntersection: (x1: number, y1: number, x2: number, y2: number) => void;
  intersectedBlocksRef: React.RefObject<Set<string>>;
  isPanningRef: React.RefObject<boolean>;
  currentStrokeId: React.RefObject<number | null>;
}

export const useArrangeModeInput = ({
  isMobile,
  startTrail,
  updateTrail,
  checkTrailIntersection,
  intersectedBlocksRef,
  isPanningRef,
  currentStrokeId,
}: UseArrangeModeInputProps) => {
  const isMobileRightClickRef = useRef(false);

  const callbacksRef = useRef({ startTrail, updateTrail, checkTrailIntersection });
  useEffect(() => {
    callbacksRef.current = { startTrail, updateTrail, checkTrailIntersection };
  }, [startTrail, updateTrail, checkTrailIntersection]);

  useEffect(() => {
    if (!isMobile) return;

    let initialPinchDist = 0;
    let initialZoom = 1;
    let initialLocalX = 0;
    let initialLocalY = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest(".settings-panel, .tutorial-overlay")) return;
      const pointers = inputManager.getPointers();
      window.__activeTouches = pointers.length;

      if (pointers.length === 1) {
        startX = e.clientX;
        startY = e.clientY;
        longPressTimer = setTimeout(() => {
          if (window.__activeTouches === 1) {
            window.dispatchEvent(new CustomEvent("mobile-long-press", { detail: { x: startX, y: startY } }));
          }
        }, 500);

        if (useGameStore.getState().gamePhase === "arrange") {
          const gc = useGameStore.getState().camera;
          const workspace = document.querySelector(".le-workspace");
          const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
          const localX = (startX - rect.left - gc.x) / gc.zoom;
          const localY = (startY - rect.top - gc.y) / gc.zoom;
          const hitBlock = useGameStore.getState().blocks.find((b) => localX >= b.x && localX <= b.x + 60 && localY >= b.y && localY <= b.y + 60);
          
          if (!hitBlock) {
            window.__panStart = { x: startX - gc.x, y: startY - gc.y };
          } else {
            window.__panStart = null;
          }
        }
      } else {
        clearTimeout(longPressTimer);
      }

      if (pointers.length >= 2 && useGameStore.getState().gamePhase === "arrange") {
        initialPinchDist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        const gc = useGameStore.getState().camera;
        initialZoom = gc.zoom;
        const centerX = (pointers[0].x + pointers[1].x) / 2;
        const centerY = (pointers[0].y + pointers[1].y) / 2;
        const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
        initialLocalX = (centerX - rect.left - gc.x) / gc.zoom;
        initialLocalY = (centerY - rect.top - gc.y) / gc.zoom;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const isCanvas = (e.target as HTMLElement)?.tagName?.toLowerCase() === "canvas";
      if (isCanvas && e.cancelable) e.preventDefault(); 

      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) clearTimeout(longPressTimer);

      const pointers = inputManager.getPointers();
      const tgc = useGameStore.getState().camera;

      if (pointers.length === 1 && useGameStore.getState().gamePhase === "arrange") {
        if (isMobileRightClickRef.current) {
          const workspace = document.querySelector(".le-workspace");
          const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
          const localX = (e.clientX - rect.left - tgc.x) / tgc.zoom;
          const localY = (e.clientY - rect.top - tgc.y) / tgc.zoom;
          callbacksRef.current.updateTrail(localX, localY, (p1, p2) => callbacksRef.current.checkTrailIntersection(p1.x, p1.y, p2.x, p2.y));
        } else if (window.__panStart && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
          useGameStore.getState().updateCamera({ x: e.clientX - window.__panStart.x, y: e.clientY - window.__panStart.y });
        }
      }

      if (pointers.length >= 2 && initialPinchDist > 0 && useGameStore.getState().gamePhase === "arrange") {
        const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        const zoomFactor = dist / initialPinchDist;
        const newZoom = clampZoom(initialZoom * zoomFactor);
        const centerX = (pointers[0].x + pointers[1].x) / 2;
        const centerY = (pointers[0].y + pointers[1].y) / 2;
        const rect = (e.target as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0 };
        const newCameraX = centerX - rect.left - initialLocalX * newZoom;
        const newCameraY = centerY - rect.top - initialLocalY * newZoom;
        useGameStore.getState().updateCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
      }
    };

    const onPointerUp = () => {
      clearTimeout(longPressTimer);
      const remainingPointers = inputManager.getPointers();
      window.__activeTouches = remainingPointers.length;

      if (remainingPointers.length === 1) {
        startX = remainingPointers[0].x;
        startY = remainingPointers[0].y;
        if (useGameStore.getState().gamePhase === "arrange") {
          const gc = useGameStore.getState().camera;
          window.__panStart = { x: startX - gc.x, y: startY - gc.y };
        }
      }
      if (remainingPointers.length < 2) initialPinchDist = 0;
      if (remainingPointers.length === 0) {
        window.__panStart = null;
        if (isMobileRightClickRef.current) {
          isMobileRightClickRef.current = false;
          currentStrokeId.current = null;
          intersectedBlocksRef.current.clear();
        }
      }
    };

    const unsubDown = inputManager.on("pointerdown", onPointerDown);
    const unsubMove = inputManager.on("pointermove", onPointerMove);
    const unsubUp = inputManager.on("pointerup", onPointerUp);

    return () => {
      clearTimeout(longPressTimer);
      unsubDown();
      unsubMove();
      unsubUp();
    };
  }, [isMobile, intersectedBlocksRef, currentStrokeId]);

  // 長按觸發右鍵監聽
  useEffect(() => {
    if (!isMobile) return;
    const onLongPress = (e: CustomEvent<{ x: number; y: number }>) => {
      if (useGameStore.getState().gamePhase !== "arrange") return;
      isMobileRightClickRef.current = true;
      isPanningRef.current = false;
      useStore.getState().clearSelection();

      const workspace = document.querySelector(".le-workspace");
      const rect = workspace ? workspace.getBoundingClientRect() : { left: 0, top: 0 };
      const gc = useGameStore.getState().camera;

      const localX = (e.detail.x - rect.left - gc.x) / gc.zoom;
      const localY = (e.detail.y - rect.top - gc.y) / gc.zoom;

      callbacksRef.current.startTrail(localX, localY);
      intersectedBlocksRef.current.clear();
      callbacksRef.current.checkTrailIntersection(localX, localY, localX, localY);
    };
    
    window.addEventListener("mobile-long-press", onLongPress as EventListener);
    return () => window.removeEventListener("mobile-long-press", onLongPress as EventListener);
  }, [isMobile, intersectedBlocksRef, isPanningRef]);

  return { isMobileRightClickRef };
};