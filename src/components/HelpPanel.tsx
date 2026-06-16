import React from 'react';
import { useStore } from '../store/useStore';
import { X, Keyboard, Mouse } from 'lucide-react';

export const HelpPanel: React.FC = () => {
  const { isHelpOpen, toggleHelp } = useStore();

  if (!isHelpOpen) return null;

  return (
    <div className="settings-panel glass-panel" style={{ width: '380px' }}>
      <div className="settings-header">
        <h2>Help & Shortcuts</h2>
        <button onClick={toggleHelp} className="icon-btn icon-btn-round">
          <X size={20} />
        </button>
      </div>

      <div className="settings-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        
        <div className="settings-section">
          <h3><Mouse size={16} /> Mouse Controls</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem', lineHeight: '1.6' }}>
            <li><strong>Left Click (Drag):</strong> Select & Move Blocks</li>
            <li><strong>Left Click (Bg):</strong> Marquee Selection</li>
            <li><strong>Right Click (Drag):</strong> Draw Play Trail</li>
            <li><strong>Middle Click (Drag):</strong> Pan Camera</li>
            <li><strong>Ctrl + Scroll:</strong> Zoom In/Out</li>
            <li style={{ marginTop: '8px' }}><strong>On Tracks:</strong></li>
            <li><strong>Left Click (Drag):</strong> Move Track</li>
            <li><strong>Right Click:</strong> Add Track Node</li>
            <li><strong>Left Click (Node):</strong> Drag Node (even in Draw mode)</li>
            <li style={{ marginTop: '8px' }}><strong>On NoteBlock:</strong></li>
            <li><strong>Scroll:</strong> Modify Pitch</li>
            <li><strong>Shift + Scroll:</strong> Modify Volume</li>
          </ul>
        </div>

        <div className="settings-section">
          <h3><Keyboard size={16} /> Keyboard Shortcuts</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem', lineHeight: '1.6' }}>
            <li><strong>Ctrl + C:</strong> Copy Selected</li>
            <li><strong>Ctrl + V:</strong> Paste</li>
            <li><strong>Ctrl + D:</strong> Duplicate Selected</li>
            <li><strong>Ctrl + A:</strong> Select All (Blocks & Tracks)</li>
            <li><strong>Ctrl + Shift + A:</strong> Select All Blocks Only</li>
            <li><strong>Ctrl + G:</strong> Group Selected</li>
            <li><strong>Ctrl + Shift + G:</strong> Ungroup Selected</li>
            <li><strong>Ctrl + Z:</strong> Undo</li>
            <li><strong>Ctrl + Y:</strong> Redo</li>
            <li><strong>Ctrl + F:</strong> Search / Outline</li>
            <li><strong>Del / Backspace:</strong> Delete Selected</li>
            <li><strong>A-Z / 0-9:</strong> Play Note (if key is bound)</li>
          </ul>
        </div>

      </div>
    </div>
  );
};
