import React from 'react';

export interface ToolbarDividerProps {
  variant?: 'playground' | 'editor';
  orientation?: 'vertical' | 'horizontal';
}

export const ToolbarDivider: React.FC<ToolbarDividerProps> = ({ 
  variant = 'playground',
  orientation = 'vertical'
}) => {
  if (variant === 'playground') {
    if (orientation === 'horizontal') {
      return <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.2)', margin: '8px 0' }} />;
    }
    return <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />;
  }
  
  if (orientation === 'horizontal') {
    return <div className="le-toolbar-divider" style={{ width: '100%', height: '1px', margin: '4px 0' }} />;
  }
  return <div className="le-toolbar-divider" />;
};
