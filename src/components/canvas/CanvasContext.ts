import { createContext, useContext } from 'react';

export type CanvasContextType = 'playground' | 'editor' | 'game';

export const CanvasContext = createContext<CanvasContextType>('playground');

export const useCanvasContext = () => useContext(CanvasContext);
