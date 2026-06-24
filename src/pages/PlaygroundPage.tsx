import { PlaygroundCanvas } from "../components/canvas/PlaygroundCanvas";
import { Toolbar } from "../components/ui/Toolbar";
import { PianoKeyboard } from "../components/instruments/PianoKeyboard";
import { DrumKeyboard } from "../components/instruments/DrumKeyboard";
import { SettingsPanel } from "../components/ui/SettingsPanel";
import { HelpPanel } from "../components/ui/HelpPanel";
import { OutlinerPanel } from "../components/ui/OutlinerPanel";
import { PocketCanvasPanel } from "../components/ui/PocketCanvasPanel";
import { ContextMenu } from "../components/ui/ContextMenu";
import { PlaybackControls } from "../components/ui/PlaybackControls";
import { SelectionPropertiesHud } from "../components/ui/SelectionPropertiesHud";
import { PocketDragOverlay } from "../components/ui/PocketDragOverlay";
import { useShortcuts } from "../hooks/useShortcuts";
import { useGameLoop } from "../hooks/useGameLoop";
import { usePlaygroundStore } from "../store/usePlaygroundStore";
import { CanvasStoreProvider } from "../store/CanvasStoreProvider";
import { useSettingsStore } from "../store";

export function PlaygroundPage() {
  const theme = useSettingsStore((state) => state.theme);

  // Initialize global shortcuts and game loop
  useShortcuts();
  useGameLoop();

  return (
    <CanvasStoreProvider store={usePlaygroundStore}>
      <div
        className={`app-container ${theme}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="main-wrapper">
          <PlaygroundCanvas />
          <h1 className="app-title">YBNote</h1>

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
              <PocketCanvasPanel />
              <PianoKeyboard />
              <DrumKeyboard />
              <SettingsPanel />
              <HelpPanel />
              <SelectionPropertiesHud />
              <ContextMenu />
              <PocketDragOverlay />
            </div>
          </div>
        </div>
      </div>
    </CanvasStoreProvider>
  );
}
