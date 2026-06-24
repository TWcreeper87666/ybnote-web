// components/canvas/BaseCanvas.tsx
import React, { useState, useEffect } from "react";
import { Application } from "@pixi/react";
import { Plus } from "lucide-react";
import { useStore } from "../../store/useStore";
import { isLevelEditor } from "../../utils/routeUtils";
import { PlayCanvas } from "./PlayCanvas";
import { EditorCanvas } from "./EditorCanvas";

interface BaseCanvasProps {
  children?: React.ReactNode;
}

export const BaseCanvas: React.FC<BaseCanvasProps> = ({ children }) => {
  const store = useStore();
  const { mode, latestPerformHit } = store;
  const blocks = isLevelEditor() ? store.gameBlocks : store.blocks;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 16);
    return () => clearInterval(id);
  }, []);
  const showFlash =
    mode === "play" && latestPerformHit && tick - latestPerformHit.time < 500;
  const isPlay = mode === "play";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Application backgroundAlpha={0} resizeTo={window} antialias={true}>
        {isPlay ? (
          <PlayCanvas blocks={blocks}>{children}</PlayCanvas>
        ) : (
          <EditorCanvas blocks={blocks}>{children}</EditorCanvas>
        )}
      </Application>

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)",
          opacity: isPlay ? 1 : 0,
          transition: "opacity 1s ease-in-out",
          zIndex: 10,
        }}
      />

      {showFlash && (
        <div
          key={`perf-bg-${latestPerformHit.time}`}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(circle, transparent 0%, rgba(${(latestPerformHit.color >> 16) & 255}, ${(latestPerformHit.color >> 8) & 255}, ${latestPerformHit.color & 255}, 0.2) 100%)`,
            animation: "flashBg 0.5s ease-out forwards",
            zIndex: 9,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          opacity: isPlay ? 0.5 : 0,
          transition: "opacity 0.3s ease-in-out",
          color: "white",
          zIndex: 11,
        }}
      >
        <Plus size={32} strokeWidth={1.5} />
      </div>
    </div>
  );
};
