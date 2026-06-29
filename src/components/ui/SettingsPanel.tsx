import React from "react";
import { useStore } from "../../store/useStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { Moon, Sun, Grid } from "lucide-react";
import { ModalPanel } from "./ModalPanel";
import { useUIStore } from "../../store/useUIStore";

export const SettingsPanel: React.FC<{ hideProjectActions?: boolean }> = ({
  hideProjectActions = false,
}) => {
  const { isSettingsOpen, toggleSettings } = useUIStore();
  const {
    theme,
    setTheme,
    showGrid,
    snapToGrid,
    setGridConfig,
    blockOpacity,
    setBlockOpacity,
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
            checked={showGrid}
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
            checked={snapToGrid}
            onChange={(e) => setGridConfig({ snapToGrid: e.target.checked })}
          />
        </label>
      </div>

      <div className="settings-section">
        <h3>Controls & Audio</h3>
        <label className="switch-row">
          <span>
            Master Volume (
            {Math.round(useSettingsStore.getState().masterVolume * 100)}%)
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={useSettingsStore.getState().masterVolume}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setMasterVolume(parseFloat(e.target.value))
            }
            style={{ width: "100px" }}
          />
        </label>
        <label className="switch-row">
          <span>
            Mouse Sensitivity (
            {useSettingsStore.getState().mouseSensitivity.toFixed(1)})
          </span>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={useSettingsStore.getState().mouseSensitivity}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setMouseSensitivity(parseFloat(e.target.value))
            }
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
            value={blockOpacity}
            onChange={(e) => setBlockOpacity(parseFloat(e.target.value))}
            style={{ width: "100px" }}
          />
        </label>
        <label className="switch-row">
          <span>Show Group Name</span>
          <input
            type="checkbox"
            checked={useSettingsStore.getState().showGroupName}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setDisplaySettings({ showGroupName: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Pitch</span>
          <input
            type="checkbox"
            checked={useSettingsStore.getState().showBlockPitch}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setDisplaySettings({ showBlockPitch: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Volume</span>
          <input
            type="checkbox"
            checked={useSettingsStore.getState().showBlockVolume}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setDisplaySettings({ showBlockVolume: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Instrument</span>
          <input
            type="checkbox"
            checked={useSettingsStore.getState().showBlockInstrument}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setDisplaySettings({ showBlockInstrument: e.target.checked })
            }
          />
        </label>
        <label className="switch-row">
          <span>Show Selection HUD</span>
          <input
            type="checkbox"
            checked={useSettingsStore.getState().showSelectionHud}
            onChange={(e) =>
              useSettingsStore
                .getState()
                .setDisplaySettings({ showSelectionHud: e.target.checked })
            }
          />
        </label>
      </div>

      {/* Actions - Hidden in Game Mode */}
      {!hideProjectActions && (
        <div className="settings-actions">
          <button
            className="action-btn"
            onClick={() => {
              const data = JSON.stringify(useStore.getState().blocks, null, 2);
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
