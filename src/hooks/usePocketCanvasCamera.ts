import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { useUIStore } from "../store/useUIStore";

export const usePocketCanvasCamera = () => {
  const isPocketCanvasOpen = useUIStore((s) => s.isPocketCanvasOpen);
  
  useEffect(() => {
    const pocketContainer = document.querySelector(".pocket-canvas-container");
    if (!pocketContainer) return;

    const handleWheel = (e: WheelEvent) => {
      const state = useStore.getState();
      if (!isPocketCanvasOpen) return;
      if (state.interactionContext !== "pocket") return;

      e.stopPropagation();
      e.preventDefault();

      // Zoom
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
      const oldZoom = state.pocketCamera.zoom;
      const newZoom = Math.min(Math.max(0.1, oldZoom * direction), 5);

      const rect = pocketContainer.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const worldX = (pointerX - state.pocketCamera.x) / oldZoom;
      const worldY = (pointerY - state.pocketCamera.y) / oldZoom;

      const newX = pointerX - worldX * newZoom;
      const newY = pointerY - worldY * newZoom;

      useStore
        .getState()
        .updatePocketCamera({ zoom: newZoom, x: newX, y: newY });
    };

    pocketContainer.addEventListener("wheel", handleWheel as EventListener, {
      passive: false,
    });
    return () =>
      pocketContainer.removeEventListener(
        "wheel",
        handleWheel as EventListener,
      );
  }, []);
};
