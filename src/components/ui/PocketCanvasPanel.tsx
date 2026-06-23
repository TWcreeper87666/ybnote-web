import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Download, SortAsc, LayoutGrid } from 'lucide-react';
import { parseMidiToPocketBlocks } from '../../utils/midiUtils';
import { PocketCanvas } from '../canvas/PocketCanvas';
import { FloatingWindow } from './FloatingWindow';

export const PocketCanvasPanel: React.FC = () => {
  const isPocketCanvasOpen = useStore(state => state.isPocketCanvasOpen);
  const togglePocketCanvas = useStore(state => state.togglePocketCanvas);
  const pocketSortMode = useStore(state => state.pocketSortMode);
  const setPocketSortMode = useStore(state => state.setPocketSortMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(280);
  const [containerHeight, setContainerHeight] = useState(280);

  useEffect(() => {
    if (containerRef.current) {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                setContainerHeight(entry.contentRect.height);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }
  }, [isPocketCanvasOpen]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseMidiToPocketBlocks(file).catch(console.error);
    }
  };

  return (
    <FloatingWindow
      title={<><LayoutGrid size={18} /> Pocket Canvas</>}
      isOpen={isPocketCanvasOpen}
      onClose={togglePocketCanvas}
      anchorSelector='button[title="Toggle Pocket Canvas"], button[title="Pocket Canvas"]'
      initialSize={{ width: '310px', height: '400px' }}
      minSize={{ width: '300px', height: '300px' }}
    >
      {isPocketCanvasOpen && (
        <>
      <div style={{ display: 'flex', gap: '8px', padding: '0 8px 8px 8px', borderBottom: '1px solid var(--panel-border)', flexShrink: 0 }}>
        <label className="toolbar-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '4px', background: 'var(--panel-bg)', borderRadius: '4px', fontSize: '14px' }}>
            <Download size={16} style={{ marginRight: '4px' }} /> Load .mid
            <input type="file" accept=".mid,.midi" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        
        <button 
            className="toolbar-btn" 
            style={{ flex: 1, padding: '4px', background: 'var(--panel-bg)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}
            onClick={() => setPocketSortMode(pocketSortMode === 'pitch' ? 'time' : 'pitch')}
        >
            <SortAsc size={16} style={{ marginRight: '4px' }} /> Sort: {pocketSortMode === 'pitch' ? 'Pitch' : 'Time'}
        </button>
      </div>

      <div ref={containerRef} className="pocket-canvas-container" style={{ flex: 1, overflow: 'hidden', position: 'relative', borderRadius: '4px', margin: '0 8px 8px 8px' }}>
          <PocketCanvas containerWidth={containerWidth} containerHeight={containerHeight} />
      </div>
      </>
      )}
    </FloatingWindow>
  );
};
