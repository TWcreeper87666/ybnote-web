import React from 'react';

export interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  variant?: 'playground' | 'editor';
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  active,
  variant = 'playground',
  className = '',
  children,
  ...props
}) => {
  const baseClass = variant === 'playground' ? 'toolbar-btn glass-panel' : 'le-toolbar-btn';
  const activeClass = active ? (variant === 'playground' ? 'primary-btn' : 'active') : '';

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
