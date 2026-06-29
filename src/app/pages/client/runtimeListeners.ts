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

type ServiceWorkerVisibilityHeartbeatOptions = {
  enabled?: boolean;
  postVisibility: (visible?: boolean) => void;
  intervalMs?: number;
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

export function useServiceWorkerVisibilityHeartbeat({
  enabled = true,
  postVisibility,
  intervalMs = 10_000,
}: ServiceWorkerVisibilityHeartbeatOptions): void {
  useEffect(() => {
    if (!enabled) return undefined;

    let heartbeatIntervalId: number | undefined;

    const stopHeartbeat = () => {
      if (heartbeatIntervalId === undefined) return;
      window.clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = undefined;
    };

    const restartHeartbeat = () => {
      stopHeartbeat();
      postVisibility();
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        heartbeatIntervalId = window.setInterval(postVisibility, intervalMs);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        restartHeartbeat();
        return;
      }
      postVisibility();
      stopHeartbeat();
    };

    const handleFocus = () => restartHeartbeat();
    const handleBlur = () => postVisibility();
    const handlePageShow = () => restartHeartbeat();

    handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      stopHeartbeat();
      postVisibility(false);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [enabled, intervalMs, postVisibility]);
}
