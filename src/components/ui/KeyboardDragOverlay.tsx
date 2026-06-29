import React, { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useGameStore } from "../../store/useGameStore";
import { useLevelEditorStore } from "../../store/useLevelEditorStore";
import { useCanvasContext } from "../canvas/CanvasContext";
import { getCanvasAdapter } from "../../store/canvasAdapter";
import { snapValue } from "../../utils/canvasUtils";
import { getPitchColorHex } from "../../utils/colors";

export const KeyboardDragOverlay: React.FC = () => {
  const canvasContext = useCanvasContext();
  const activeDrag = useStore((state) => state.activeKeyboardDrag);
  const pianoKeysCount = useSettingsStore((state) => state.pianoKeysCount);

  const playgroundCameraZoom = useStore((state) => state.camera.zoom);
  const editorCameraZoom = useLevelEditorStore((state) => state.camera.zoom);
  const canvasZoom =
    canvasContext === "editor" ? editorCameraZoom : playgroundCameraZoom;

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  // 新增：判斷游標是否還在鍵盤面板上
  const [isHoveringPanel, setIsHoveringPanel] = useState(true);

  useEffect(() => {
    if (!activeDrag) return;

    const handleMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // 探測底下的元素是不是鍵盤面板
      const target = document.elementFromPoint(e.clientX, e.clientY);
      setIsHoveringPanel(!!target?.closest(".piano-container"));
    };

    const handleUp = (e: PointerEvent) => {
      const state = useStore.getState();

      const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
      if (dropTarget?.closest(".piano-container")) {
        state.setActiveKeyboardDrag(null);
        return;
      }

      const adapter = getCanvasAdapter(canvasContext);
      const camera = adapter.getCamera();

      const canvas =
        document.querySelector(".le-blocks-container canvas") ||
        document.querySelector(".main-wrapper canvas");
      const rect = canvas
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0 };

      const localX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const localY = (e.clientY - rect.top - camera.y) / camera.zoom;

      let finalX = localX - 30;
      let finalY = localY - 30;

      if (useSettingsStore.getState().snapToGrid) {
        finalX = snapValue(finalX);
        finalY = snapValue(finalY);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctxSt =
        canvasContext === "editor"
          ? useLevelEditorStore.getState()
          : canvasContext === "game"
            ? useGameStore.getState()
            : useStore.getState();

      const newBlockId = ctxSt.addBlock({
        pitch: activeDrag.pitch,
        x: finalX,
        y: finalY,
        instrument: activeDrag.instrument,
      });

      adapter.selectBlock(newBlockId, false);
      state.setActiveKeyboardDrag(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setMousePos(null);
      setIsHoveringPanel(true);
    };
  }, [activeDrag, canvasContext]);

  if (!activeDrag) return null;

  // 動態決定目前的縮放比例：如果在面板上保持 1 倍大，移出面板則縮小為畫布的 zoom
  const currentZoom = isHoveringPanel ? 1 : canvasZoom;

  const displayX = mousePos ? mousePos.x : activeDrag.initialX;
  const displayY = mousePos ? mousePos.y : activeDrag.initialY;
  const isDrum = activeDrag.instrument === "percussion";

  return (
    <div
      style={{
        position: "fixed",
        left: displayX - 30,
        top: displayY - 30,
        width: 60,
        height: 60,

        transform: `scale(${currentZoom})`,
        transformOrigin: "center center",

        backgroundColor: getPitchColorHex(activeDrag.pitch, pianoKeysCount),
        borderRadius: isDrum ? "50%" : 8,

        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0.8,

        border: "2px solid white",

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        color: "white",
        fontWeight: "bold",
        fontSize: 14,

        textShadow: "0px 1px 2px rgba(0,0,0,0.5)",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",

        transition: "transform 0.2s ease",
      }}
    >
      {currentZoom > 0.5 && activeDrag.pitch}
    </div>
  );
};
