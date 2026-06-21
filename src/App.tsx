import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { GamePage } from './pages/GamePage';
import { LevelEditorPage } from './pages/LevelEditorPage';
import { Toast } from './components/ui/Toast';
import './index.css';

function App() {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/level-editor" element={<LevelEditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toast />
    </>
  );
}

export default App;

