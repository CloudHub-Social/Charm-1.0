import { useEffect } from 'react';

export const useKeyDown = (target: Window, callback: (evt: KeyboardEvent) => void) => {
  useEffect(() => {
    target.addEventListener('keydown', callback, { capture: true });
    return () => {
      target.removeEventListener('keydown', callback, true);
    };
  }, [target, callback]);
};
