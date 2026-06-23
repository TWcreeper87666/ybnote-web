import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface FloatingWindowProps {
  title: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: string | number; height: string | number };
  minSize?: { width: string | number; height: string | number };
  className?: string;
  style?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  anchorSelector?: string;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  title,
  isOpen,
  onClose,
  children,
  initialPosition,
  initialSize,
  minSize,
  className = '',
  style = {},
  headerStyle = {},
  anchorSelector
}) => {
  const [position, setPosition] = useState(() => {
    if (initialPosition) return initialPosition;
    
    // Default to right side
    const widthStr = String(initialSize?.width || '300');
    const width = parseInt(widthStr.replace(/[^0-9]/g, ''), 10) || 300;
    
    return {
      x: window.innerWidth - width - 95,
      y: 80
    };
  });
  const [hasInitializedPosition, setHasInitializedPosition] = useState(!!initialPosition || !anchorSelector);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasInitializedPosition && anchorSelector) {
      requestAnimationFrame(() => {
        const btn = document.querySelector(anchorSelector);
        if (btn) {
            const rect = btn.getBoundingClientRect();
            const heightStr = String(initialSize?.height || '400');
            const height = parseInt(heightStr.replace(/[^0-9]/g, ''), 10) || 400;
            let defaultY = rect.top + rect.height / 2 - height / 2;
            defaultY = Math.max(24, Math.min(defaultY, window.innerHeight - height - 24));
            
            setPosition(prev => ({ ...prev, y: defaultY }));
        }
        setHasInitializedPosition(true);
      });
    }
  }, [hasInitializedPosition, anchorSelector, initialSize]);

  useEffect(() => {
    if (windowRef.current && initialSize) {
       if (initialSize.width) windowRef.current.style.width = typeof initialSize.width === 'number' ? `${initialSize.width}px` : initialSize.width;
       if (initialSize.height) windowRef.current.style.height = typeof initialSize.height === 'number' ? `${initialSize.height}px` : initialSize.height;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={windowRef}
      className={`outliner-panel glass-panel floating-window ${className}`}
      style={{ 
        left: position.x, 
        top: position.y, 
        margin: 0, 
        resize: 'both',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        ...(minSize && { minWidth: minSize.width, minHeight: minSize.height }),
        ...style 
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div 
        className="select-none"
        style={{ 
          cursor: 'move', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '8px', 
          flexShrink: 0,
          ...headerStyle 
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h2 className="pointer-events-none" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 600 }}>
          {title}
        </h2>
        <button 
          className="icon-btn icon-btn-round" 
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()} 
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  );
};
