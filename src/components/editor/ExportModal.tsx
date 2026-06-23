import React, { useState, useEffect } from 'react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { FileDown, X } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (fileName: string, compressAudio: boolean) => void;
  defaultFileName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport, defaultFileName }) => {
  const store = useLevelEditorStore();
  const [fileName, setFileName] = useState(defaultFileName);
  const [compressAudio, setCompressAudio] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileName(defaultFileName);
    }
  }, [isOpen, defaultFileName]);

  const handleExport = () => {
    onExport(fileName || defaultFileName, compressAudio);
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 100 }} 
        onClick={onClose} 
      />
      <div className="glass-panel" style={{ 
        position: 'fixed', 
        top: 48, 
        left: 12, 
        zIndex: 101, 
        width: 320,
        padding: 20,
        display: 'flex', 
        flexDirection: 'column', 
        gap: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(30,30,35,0.95)',
        backdropFilter: 'blur(12px)',
        color: 'white',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Export Level</h3>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>File Name</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="text" 
              className="le-input" 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. my_awesome_level"
              style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', fontSize: 14, outline: 'none' }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <span style={{ color: '#9ca3af', fontSize: 14 }}>.yblevel</span>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Title (Optional)</label>
          <input 
            type="text" 
            className="le-input" 
            value={store.levelTitle}
            onChange={(e) => store.setLevelMetadata({ levelTitle: e.target.value })}
            placeholder="Song Title"
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', fontSize: 14, outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Author (Optional)</label>
          <input 
            type="text" 
            className="le-input" 
            value={store.levelAuthor}
            onChange={(e) => store.setLevelMetadata({ levelAuthor: e.target.value })}
            placeholder="Chart Author"
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', fontSize: 14, outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>MIDI Credit (Optional)</label>
          <input 
            type="text" 
            className="le-input" 
            value={store.levelMidiCredit}
            onChange={(e) => store.setLevelMetadata({ levelMidiCredit: e.target.value })}
            placeholder="Original MIDI Author"
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', fontSize: 14, outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Music Credit (Optional)</label>
          <input 
            type="text" 
            className="le-input" 
            value={store.levelMusicCredit}
            onChange={(e) => store.setLevelMetadata({ levelMusicCredit: e.target.value })}
            placeholder="Original Song Author"
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', fontSize: 14, outline: 'none' }}
            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Description (Optional)</label>
          <textarea 
            className="le-input" 
            value={store.levelDescription}
            onChange={(e) => store.setLevelMetadata({ levelDescription: e.target.value })}
            placeholder="Level description..."
            style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'white', fontSize: 14, outline: 'none', height: 80, resize: 'vertical', fontFamily: 'inherit' }}
            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9ca3af', cursor: 'pointer', marginTop: 4 }}>
          <input 
            type="checkbox" 
            checked={compressAudio}
            onChange={(e) => setCompressAudio(e.target.checked)}
            style={{ accentColor: '#6366f1', width: 16, height: 16, cursor: 'pointer' }}
          />
          Trim and Compress Audio
        </label>

        <button 
          className="primary-btn" 
          onClick={handleExport}
          style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          <FileDown size={16} />
          Export
        </button>
      </div>
    </>
  );
};
