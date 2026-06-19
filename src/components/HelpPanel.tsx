import React from 'react';
import { useStore } from '../store/useStore';
import { X, Keyboard, Mouse } from 'lucide-react';

export const HelpPanel: React.FC = () => {
  const { isHelpOpen, toggleHelp } = useStore();

  if (!isHelpOpen) return null;

  return (
    <div 
      className="settings-panel glass-panel" 
      style={{ width: '380px' }}
      onWheel={(e) => e.stopPropagation()}
    >
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
            <li><strong>Double Click (Bg):</strong> Spawn identical object (based on last interaction)</li>
            <li><strong>Right Click (Drag):</strong> Draw Play Trail</li>
            <li><strong>Middle Click (Drag):</strong> Pan Camera</li>
            <li><strong>Scroll (Bg):</strong> Zoom In/Out</li>
            <li style={{ marginTop: '8px' }}><strong>On Any Object:</strong></li>
            <li><strong>Double Click:</strong> Open Context Menu</li>
            <li style={{ marginTop: '8px' }}><strong>On Tracks:</strong></li>
            <li><strong>Left Click (Drag):</strong> Move Track</li>
            <li><strong>Right Click (Line):</strong> Add Track Node</li>
            <li><strong>Right Click (Node):</strong> Remove Track Node</li>
            <li><strong>Left Click (Node):</strong> Drag Node (even in Draw mode)</li>
            <li style={{ marginTop: '8px' }}><strong>On Group Rect:</strong></li>
            <li><strong>Left Click (Edge):</strong> Resize Group Rect</li>
            <li style={{ marginTop: '8px' }}><strong>On NoteBlock:</strong></li>
            <li><strong>Scroll:</strong> Modify Pitch</li>
            <li><strong>Shift + Scroll:</strong> Modify Volume</li>
            <li style={{ marginTop: '8px' }}><strong>In Perform Mode (Mode 5):</strong></li>
            <li><strong>Mouse Move:</strong> Look Around</li>
            <li><strong>Hold Any Click:</strong> Draw Trail / Trigger Notes</li>
            <li><strong>Esc:</strong> Exit Perform Mode</li>
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
            <li><strong>Ctrl + Z:</strong> Undo</li>
            <li><strong>Ctrl + Y:</strong> Redo</li>
            <li><strong>Ctrl + F:</strong> Search / Outline</li>
            <li><strong>F2:</strong> Rename Selected Group/Track (in Outliner)</li>
            <li><strong>Del / Backspace:</strong> Delete Selected</li>
            <li><strong>1-5:</strong> Switch Modes (Note, Drum, Group, Track, Perform)</li>
            <li><strong>A-Z / 0-9:</strong> Play Note (if key is bound)</li>
          </ul>
        </div>

      </div>
    </div>
  );
};
