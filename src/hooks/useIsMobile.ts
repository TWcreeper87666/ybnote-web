import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const isNarrow = window.innerWidth <= 768;
      const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      setIsMobile(isNarrow || hasTouch);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}
