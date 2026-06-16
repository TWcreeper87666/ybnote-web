import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { extend } from '@pixi/react';
import { Container, Graphics, Text } from 'pixi.js';

// PixiJS v8 requires us to explicitly extend the React reconciler
extend({ Container, Graphics, Text });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
