import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';

export const Toast: React.FC = () => {
  const toastMessage = useStore(state => state.toastMessage);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(false);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? '0' : '20px'}) scale(${isVisible ? 1 : 0.95})`,
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        color: 'white',
        padding: '12px 28px',
        borderRadius: '24px',
        fontSize: '15px',
        fontWeight: 500,
        zIndex: 99999,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      {toastMessage?.text}
    </div>
  );
};
