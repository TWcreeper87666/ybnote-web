import React from 'react';
import { useStore } from '../store/useStore';
import { X, Moon, Sun, Grid } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const { isSettingsOpen, toggleSettings, theme, setTheme, showGrid, snapToGrid, setGridConfig, blockOpacity, setBlockOpacity } = useStore();

  if (!isSettingsOpen) return null;

  return (
    <div className="settings-panel glass-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button onClick={toggleSettings} className="icon-btn icon-btn-round">
          <X size={20} />
        </button>
      </div>

      <div className="settings-body">
        {/* Theme Toggle */}
        <div className="settings-row">
          <span className="settings-label">
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Theme
          </span>
          <div className="toggle-group">
            <button 
              className={`toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <button 
              className={`toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Grid Settings */}
        <div className="settings-section">
          <h3><Grid size={16} /> Grid & Snap</h3>
          
          <label className="switch-row">
            <span>Show Grid</span>
            <div className={`switch-track ${showGrid ? 'active' : ''}`}>
              <div className="switch-thumb" />
            </div>
            <input type="checkbox" className="hidden" checked={showGrid} onChange={(e) => setGridConfig({ showGrid: e.target.checked })} />
          </label>

          <label className="switch-row">
            <span>Snap to Grid</span>
            <div className={`switch-track ${snapToGrid ? 'active' : ''}`}>
              <div className="switch-thumb" />
            </div>
            <input type="checkbox" className="hidden" checked={snapToGrid} onChange={(e) => setGridConfig({ snapToGrid: e.target.checked })} />
          </label>
        </div>

        <div className="settings-section">
          <h3>Piano & Blocks</h3>
          <label className="switch-row">
            <span>Keys Count</span>
            <input 
              type="number" 
              min="12" max="88" 
              value={useStore.getState().pianoKeysCount} 
              onChange={(e) => useStore.getState().setPianoKeysCount(parseInt(e.target.value) || 36)} 
              style={{ width: '60px', background: 'transparent', border: '1px solid gray', color: 'inherit', padding: '4px', borderRadius: '4px' }}
            />
          </label>
          <label className="switch-row">
            <span>Block Opacity</span>
            <input 
              type="range" 
              min="0.1" max="1" step="0.1"
              value={blockOpacity} 
              onChange={(e) => setBlockOpacity(parseFloat(e.target.value))} 
              style={{ width: '100px' }}
            />
          </label>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <button 
            className="action-btn"
            onClick={() => {
              const data = JSON.stringify(useStore.getState().blocks, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ybnote-project-${new Date().toISOString().slice(0,10)}.json`;
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
                      console.error('Failed to parse JSON', err);
                    }
                  };
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
