import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { EditorPage } from './pages/EditorPage';
import { GamePage } from './pages/GamePage';
import { LevelEditorPage } from './pages/LevelEditorPage';
import { Toast } from './components/ui/Toast';
import './index.css';

function App() {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/level-editor" element={<LevelEditorPage />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </Routes>
      </HashRouter>
      <Toast />
    </>
  );
}

export default App;

