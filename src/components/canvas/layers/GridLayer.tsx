import React from 'react';
import { useStore } from '../../../store/useStore';
import { useLevelEditorStore } from '../../../store/useLevelEditorStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { GridBackground } from '../shared/GridBackground';

interface GridLayerProps {
  context: 'playground' | 'editor';
}

export const GridLayer: React.FC<GridLayerProps> = ({ context }) => {
  const playgroundCamera = useStore(s => s.camera);
  const editorCamera = useLevelEditorStore(s => s.camera);
  const zoom = (context === 'editor' ? editorCamera : playgroundCamera).zoom;
  const { showGrid, theme } = useSettingsStore();
  return <GridBackground showGrid={showGrid} theme={theme} zoom={zoom} />;
};
