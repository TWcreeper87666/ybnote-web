import React from 'react';

export interface ToolbarDividerProps {
  variant?: 'playground' | 'editor';
}

export const ToolbarDivider: React.FC<ToolbarDividerProps> = ({ variant = 'playground' }) => {
  if (variant === 'playground') {
    return <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />;
  }
  
  return <div className="le-toolbar-divider" />;
};
