import React, { useEffect } from 'react';

export interface EditorContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({ x, y, onClose, children }) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [onClose]);

  return (
    <div 
      className="le-context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {children}
    </div>
  );
};

export const EditorContextMenuItem: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}> = ({ onClick, children, danger }) => (
  <button 
    className={`le-cm-item ${danger ? 'danger' : ''}`} 
    onClick={onClick}
  >
    {children}
  </button>
);

export const EditorContextMenuDivider: React.FC = () => (
  <div className="le-cm-divider" />
);
