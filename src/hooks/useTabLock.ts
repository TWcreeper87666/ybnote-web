import { useState, useEffect } from 'react';

export type TabLockStatus = 'loading' | 'acquired' | 'blocked';

export function useTabLock(lockName: string): TabLockStatus {
  const [status, setStatus] = useState<TabLockStatus>('loading');

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('locks' in navigator)) {
      setStatus('acquired');
      return;
    }

    let released = false;
    let resolveHold: (() => void) | null = null;

    navigator.locks.request(
      lockName,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          if (!released) setStatus('blocked');
          return;
        }
        // Cleanup already ran (React StrictMode double-invoke) — release immediately.
        if (released) return;
        setStatus('acquired');
        await new Promise<void>((resolve) => {
          resolveHold = resolve;
          // Guard: cleanup may have raced with this setup line
          if (released) resolve();
        });
      }
    );

    return () => {
      released = true;
      resolveHold?.();
    };
  }, [lockName]);

  return status;
}
