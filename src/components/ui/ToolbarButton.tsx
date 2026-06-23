import React from 'react';

export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  variant?: 'playground' | 'editor' | 'panel-toggle';
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  active,
  variant = 'playground',
  className = '',
  children,
  ...props
}) => {
  const baseClass = variant === 'playground' || variant === 'panel-toggle' ? 'toolbar-btn glass-panel' : 'le-toolbar-btn';
  
  let activeClass = '';
  if (active) {
    if (variant === 'playground') activeClass = 'primary-btn';
    else if (variant === 'panel-toggle') activeClass = 'active-panel-btn';
    else activeClass = 'active';
  }

  return (
    <button
      className={`${baseClass} ${activeClass} ${className}`.trim()}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};
