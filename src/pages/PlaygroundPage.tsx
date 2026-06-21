import { Canvas } from '../components/canvas/Canvas';
import { Toolbar } from '../components/ui/Toolbar';
import { PianoKeyboard } from '../components/instruments/PianoKeyboard';
import { DrumKeyboard } from '../components/instruments/DrumKeyboard';
import { SettingsPanel } from '../components/ui/SettingsPanel';
import { HelpPanel } from '../components/ui/HelpPanel';
import { OutlinerPanel } from '../components/ui/OutlinerPanel';
import { ContextMenu } from '../components/ui/ContextMenu';
import { PlaybackControls } from '../components/ui/PlaybackControls';
import { SelectionPropertiesHud } from '../components/ui/SelectionPropertiesHud';
import { useStore } from '../store/useStore';
import { useShortcuts } from '../hooks/useShortcuts';
import { useGameLoop } from '../hooks/useGameLoop';

export function PlaygroundPage() {
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
          YBNote
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
            <OutlinerPanel />
            <PianoKeyboard />
            <DrumKeyboard />
            <SettingsPanel />
            <HelpPanel />
            <SelectionPropertiesHud />
            <ContextMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
