import { useEffect } from 'react';

type VisibilityAndPageShowOptions = {
  enabled?: boolean;
  onVisibilityChange: () => void;
  onPageShow?: () => void;
};

type VisibilityFocusBlurPageShowOptions = {
  enabled?: boolean;
  onVisibilityChange: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onPageShow: () => void;
};

export function useServiceWorkerMessageListener(
  handler: (event: MessageEvent) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return undefined;

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [enabled, handler]);
}

export function useVisibilityAndPageShowListeners({
  enabled = true,
  onVisibilityChange,
  onPageShow,
}: VisibilityAndPageShowOptions): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const handlePageShow = onPageShow ?? onVisibilityChange;
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [enabled, onPageShow, onVisibilityChange]);
}

export function useVisibilityFocusBlurPageShowListeners({
  enabled = true,
  onVisibilityChange,
  onFocus,
  onBlur,
  onPageShow,
}: VisibilityFocusBlurPageShowOptions): void {
  useEffect(() => {
    if (!enabled) return undefined;

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled, onBlur, onFocus, onPageShow, onVisibilityChange]);
}
