import React from 'react';
import { TrailRenderer } from '../shared/TrailRenderer';
import type { TrailStroke } from '../shared/TrailRenderer';

interface TrailLayerProps {
  activeStrokesRef: React.MutableRefObject<TrailStroke[]>;
  currentStrokeId: React.MutableRefObject<number | null>;
}

export const TrailLayer: React.FC<TrailLayerProps> = ({ activeStrokesRef, currentStrokeId }) => (
  <TrailRenderer activeStrokesRef={activeStrokesRef} currentStrokeId={currentStrokeId} />
);
