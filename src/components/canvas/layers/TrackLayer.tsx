import React from 'react';
import { TrackRenderer } from '../../containers/TrackRenderer';

interface TrackLayerProps {
  onNodeDeletedByDrag: () => void;
}

export const TrackLayer: React.FC<TrackLayerProps> = ({ onNodeDeletedByDrag }) => (
  <TrackRenderer onNodeDeletedByDrag={onNodeDeletedByDrag} />
);
