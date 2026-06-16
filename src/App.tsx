import './index.css';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PianoKeyboard } from './components/PianoKeyboard';
import { DrumKeyboard } from './components/DrumKeyboard';
import { SettingsPanel } from './components/SettingsPanel';
import { HelpPanel } from './components/HelpPanel';
import { HierarchyPanel } from './components/HierarchyPanel';
import { ContextMenu } from './components/ContextMenu';
import { PlaybackControls } from './components/PlaybackControls';
import { TrackPropertiesPopup } from './components/TrackPropertiesPopup';
import { useStore } from './store/useStore';
import { useShortcuts } from './hooks/useShortcuts';

import { useGameLoop } from './hooks/useGameLoop';

function App() {
  const theme = useStore((state) => state.theme);
  
  // Initialize global shortcuts and game loop
  useShortcuts();
  useGameLoop();

  return (
    <div 
      className={`app-container ${theme}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="main-wrapper">
        <Canvas />
        <h1 className="app-title">
          YBNote Music Game
        </h1>
        
        {/* UI Overlay */}
        <div className="ui-overlay">
          <div 
            className="ui-pointer-events"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
          >
            <PlaybackControls />
            <Toolbar />
            <HierarchyPanel />
            <PianoKeyboard />
            <DrumKeyboard />
            <SettingsPanel />
            <HelpPanel />
            <ContextMenu />
            <TrackPropertiesPopup />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
