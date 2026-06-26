import { useRef } from 'react';

export const useDoubleClick = (threshold = 300) => {
  const lastClickTimeRef = useRef(0);

  const isDoubleClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < threshold) {
      lastClickTimeRef.current = 0;
      return true;
    }
    lastClickTimeRef.current = now;
    return false;
  };

  return { isDoubleClick };
};
