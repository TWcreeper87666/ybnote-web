import React from "react";
import { Moon, Sun, Grid } from "lucide-react";
import { ModalPanel } from "./ModalPanel";
import { isGame } from "../../utils/routeUtils";
import { useCanvasStore, useSettingsStore, useStore } from "../../store";

export const SettingsPanel: React.FC = () => {
  const { isSettingsOpen, toggleSettings } = useStore();
  const blocks = useCanvasStore((s) => s.blocks);

  const {
    theme,
    setTheme,
    setGridConfig,
    showGrid,
    snapToGrid,

    // Controls & Audio
    masterVolume,
    setMasterVolume,
    mouseSensitivity,
    setMouseSensitivity,

    // Block Display
    blockOpacity,
    setBlockOpacity,
    showGroupName,
    showBlockPitch,
    showBlockVolume,
    showBlockInstrument,
    setDisplaySettings,
  } = useSettingsStore();

  return (
    <ModalPanel
      title="Settings"
      isOpen={isSettingsOpen}
      onClose={toggleSettings}
    >
      {/* Theme Toggle */}
      <div className="settings-row">
        <span className="settings-label">
          {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />} Theme
        </span>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={`toggle-btn ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </div>

      {/* Grid Settings */}
      <div className="settings-section">
        <h3>
          <Grid size={16} /> Grid & Snap
        </h3>

        <label className="switch-row">
          <span>Show Grid</span>
          <div className={`switch-track ${showGrid ? "active" : ""}`}>
            <div className="switch-thumb" />
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={!!showGrid}
            onChange={(e) => setGridConfig({ showGrid: e.target.checked })}
          />
        </label>

        <label className="switch-row">
          <span>Snap to Grid</span>
          <div className={`switch-track ${snapToGrid ? "active" : ""}`}>
            <div className="switch-thumb" />
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={!!snapToGrid}
            onChange={(e) => setGridConfig({ snapToGrid: e.target.checked })}
          />
        </label>
      </div>

      <div className="settings-section">
        <h3>Controls & Audio</h3>
        <label className="switch-row">
          <span>
            Master Volume ({Math.round(masterVolume * 100)}
            %)
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            style={{ width: "100px" }}
          />
        </label>
        <label className="switch-row">
          <span>Mouse Sensitivity ({mouseSensitivity.toFixed(1)})</span>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={mouseSensitivity}
            onChange={(e) => setMouseSensitivity(parseFloat(e.target.value))}
            style={{ width: "100px" }}
          />
        </label>
      </div>

      <div className="settings-section">
        <h3>Block Display</h3>
        <label className="switch-row">
          <span>Block Opacity</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={Number(blockOpacity)}
            onChange={(e) => setBlockOpacity(parseFloat(e.target.value))}
            style={{ width: "100px" }}
          />
        </label>
        <label className="switch-row">
          <span>Show Group Name</span>
          <input
            type="checkbox"
            checked={!!showGroupName}
            onChange={(e) =>
              setDisplaySettings({ showGroupName: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Pitch</span>
          <input
            type="checkbox"
            checked={!!showBlockPitch}
            onChange={(e) =>
              setDisplaySettings({ showBlockPitch: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Volume</span>
          <input
            type="checkbox"
            checked={!!showBlockVolume}
            onChange={(e) =>
              setDisplaySettings({ showBlockVolume: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Instrument</span>
          <input
            type="checkbox"
            checked={!!showBlockInstrument}
            onChange={(e) =>
              setDisplaySettings({ showBlockInstrument: e.target.checked })
            }
          />
        </label>
      </div>

      {/* Actions - Hidden in Game Mode */}
      {!isGame() && (
        <div className="settings-actions">
          <button
            className="action-btn"
            onClick={() => {
              const data = JSON.stringify(blocks, null, 2);
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ybnote-project-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Save Project (JSON)
          </button>

          <label className="action-btn text-center cursor-pointer">
            Load Project (JSON)
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const blocks = JSON.parse(ev.target?.result as string);
                      if (Array.isArray(blocks)) {
                        useStore.setState({ blocks });
                      }
                    } catch (err) {
                      console.error("Failed to parse JSON", err);
                    }
                  };
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>
      )}
    </ModalPanel>
  );
};
