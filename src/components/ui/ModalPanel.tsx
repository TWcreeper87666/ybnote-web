import React from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ModalPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ModalPanel: React.FC<ModalPanelProps> = ({ title, isOpen, onClose, children, className = '', style = {} }) => {
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  return (
    <div 
      className={`settings-panel glass-panel ${className}`}
      style={{
        ...(isMobile ? { position: 'fixed', top: '10%', left: '5%', width: '90%', maxWidth: 'none', right: 'auto', zIndex: 1000 } : {}),
        ...style
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="settings-header">
        <h2>{title}</h2>
        <button onClick={onClose} className="icon-btn icon-btn-round">
          <X size={20} />
        </button>
      </div>

      <div className="settings-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
};
