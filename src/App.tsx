import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { GamePage } from './pages/GamePage';
import { LevelEditorPage } from './pages/LevelEditorPage';
import { Toast } from './components/ui/Toast';
import { SingleTabGuard } from './components/ui/SingleTabGuard';
import './index.css';

function App() {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/playground" element={
            <SingleTabGuard lockName="ybnote-lock-playground">
              <PlaygroundPage />
            </SingleTabGuard>
          } />
          <Route path="/game" element={
            <SingleTabGuard lockName="ybnote-lock-game">
              <GamePage />
            </SingleTabGuard>
          } />
          <Route path="/level-editor" element={
            <SingleTabGuard lockName="ybnote-lock-level-editor">
              <LevelEditorPage />
            </SingleTabGuard>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toast />
    </>
  );
}

export default App;

