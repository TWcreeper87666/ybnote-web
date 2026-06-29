import React from 'react';
import { Plus } from 'lucide-react';

interface OverlayLayerProps {
  mode: string;
  latestPerformHit: { time: number; color: number } | null;
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({ mode, latestPerformHit }) => (
  <>
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)', opacity: mode === 'perform' ? 1 : 0, transition: 'opacity 1s ease-in-out', zIndex: 10 }} />

    {mode === 'perform' && latestPerformHit && Date.now() - latestPerformHit.time < 500 && (
      <div key={`perf-bg-${latestPerformHit.time}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle, transparent 0%, rgba(${(latestPerformHit.color >> 16) & 255}, ${(latestPerformHit.color >> 8) & 255}, ${latestPerformHit.color & 255}, 0.2) 100%)`, animation: 'flashBg 0.5s ease-out forwards', zIndex: 9 }} />
    )}

    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: mode === 'perform' ? 0.5 : 0, transition: 'opacity 0.3s ease-in-out', color: 'white', zIndex: 11 }}>
      <Plus size={32} strokeWidth={1.5} />
    </div>
  </>
);
