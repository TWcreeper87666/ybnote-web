import './index.css';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { PianoKeyboard } from './components/PianoKeyboard';
import { SettingsPanel } from './components/SettingsPanel';
import { HierarchyPanel } from './components/HierarchyPanel';
import { ContextMenu } from './components/ContextMenu';
import { useStore } from './store/useStore';
import { useShortcuts } from './hooks/useShortcuts';

function App() {
  const theme = useStore((state) => state.theme);
  
  // Initialize global shortcuts
  useShortcuts();

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
            <Toolbar />
            <HierarchyPanel />
            <PianoKeyboard />
            <SettingsPanel />
            <ContextMenu />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
