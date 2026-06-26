import React from 'react';
import { CanvasContext } from '../components/canvas/CanvasContext';
import type { CanvasContextType } from '../components/canvas/CanvasContext';
import { CanvasAdapterCtx, gameCanvasAdapter, editorCanvasAdapter, playgroundCanvasAdapter } from './canvasAdapter';

export const CanvasProvider: React.FC<{ type: CanvasContextType; children: React.ReactNode }> = ({ type, children }) => (
  <CanvasContext.Provider value={type}>
    <CanvasAdapterCtx.Provider value={
      type === 'game'   ? gameCanvasAdapter :
      type === 'editor' ? editorCanvasAdapter :
                          playgroundCanvasAdapter
    }>
      {children}
    </CanvasAdapterCtx.Provider>
  </CanvasContext.Provider>
);
