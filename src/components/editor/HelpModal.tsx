import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="le-modal-overlay" onClick={onClose}>
      <div className="le-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="le-modal-header">
          <h2>Editor Help & Shortcuts</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>
        <div className="le-modal-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#8a8a93', textTransform: 'uppercase' }}>Mouse Operations</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Left Click (Empty space)</strong> Add a new note
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Left Click (On note)</strong> Select note
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Right Click (On note)</strong> Delete note
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + Drag</strong> Marquee selection
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Middle Mouse Drag</strong> Pan the view
              </li>
              <li style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + Scroll</strong> Zoom in/out
              </li>
            </ul>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#8a8a93', textTransform: 'uppercase' }}>Keyboard Shortcuts</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Space</strong> Play / Stop
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + A</strong> Select all notes
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + C</strong> Copy selected notes
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + V</strong> Paste notes
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Delete / Backspace</strong> Delete selected notes
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + Z</strong> Undo
              </li>
              <li style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Ctrl + Y / Ctrl+Shift+Z</strong> Redo
              </li>
            </ul>
          </div>

          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#8a8a93', textTransform: 'uppercase' }}>Track Management</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Track Panel (Left)</strong> Click to select a track
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>F2 / Double-click track name</strong> Rename track
              </li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Eye icon (👁)</strong> Toggle ghost notes
              </li>
              <li style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#ccc' }}>
                <strong style={{ color: '#a5b4fc' }}>Cross-track paste</strong> Copy notes from one track, switch, paste
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};
