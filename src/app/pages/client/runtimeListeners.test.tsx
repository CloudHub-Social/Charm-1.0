import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useServiceWorkerMessageListener,
  useServiceWorkerVisibilityHeartbeat,
  useVisibilityAndPageShowListeners,
  useVisibilityFocusBlurPageShowListeners,
} from './runtimeListeners';

describe('runtimeListeners', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn<(type: string, listener: EventListener) => void>(),
        removeEventListener: vi.fn<(type: string, listener: EventListener) => void>(),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('registers and cleans up service worker message listeners', () => {
    const handler = vi.fn<(event: MessageEvent) => void>();
    const addSpy = vi.spyOn(navigator.serviceWorker, 'addEventListener');
    const removeSpy = vi.spyOn(navigator.serviceWorker, 'removeEventListener');

    const { unmount } = renderHook(() => useServiceWorkerMessageListener(handler));

    expect(addSpy).toHaveBeenCalledWith('message', handler);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('message', handler);
  });

  it('registers visibility and pageshow listeners together', () => {
    const onVisibilityChange = vi.fn<() => void>();
    const onPageShow = vi.fn<() => void>();
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const windowAdd = vi.spyOn(window, 'addEventListener');

    const { unmount } = renderHook(() =>
      useVisibilityAndPageShowListeners({ onVisibilityChange, onPageShow })
    );

    expect(documentAdd).toHaveBeenCalledWith('visibilitychange', onVisibilityChange);
    expect(windowAdd).toHaveBeenCalledWith('pageshow', onPageShow);
    unmount();
  });

  it('registers visibility, focus, blur, and pageshow listeners together', () => {
    const onVisibilityChange = vi.fn<() => void>();
    const onFocus = vi.fn<() => void>();
    const onBlur = vi.fn<() => void>();
    const onPageShow = vi.fn<() => void>();
    const windowAdd = vi.spyOn(window, 'addEventListener');

    renderHook(() =>
      useVisibilityFocusBlurPageShowListeners({
        onVisibilityChange,
        onFocus,
        onBlur,
        onPageShow,
      })
    );

    expect(windowAdd).toHaveBeenCalledWith('focus', onFocus);
    expect(windowAdd).toHaveBeenCalledWith('blur', onBlur);
    expect(windowAdd).toHaveBeenCalledWith('pageshow', onPageShow);
  });

  it('starts and stops the service worker visibility heartbeat based on visibility and focus', () => {
    const postVisibility = vi.fn<() => void>();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    let currentVisibilityState: DocumentVisibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => currentVisibilityState,
    });
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: vi.fn<() => boolean>(() => true),
    });

    renderHook(() => useServiceWorkerVisibilityHeartbeat({ postVisibility, intervalMs: 1000 }));

    expect(postVisibility).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(postVisibility).toHaveBeenCalledTimes(2);

    currentVisibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    expect(postVisibility).toHaveBeenCalledTimes(3);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(postVisibility).toHaveBeenCalledTimes(3);
  });

  it('posts visibility on blur and restarts the heartbeat on focus/pageshow', () => {
    const postVisibility = vi.fn<() => void>();
    let focused = false;

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: vi.fn<() => boolean>(() => focused),
    });

    renderHook(() => useServiceWorkerVisibilityHeartbeat({ postVisibility, intervalMs: 1000 }));

    expect(postVisibility).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('blur'));
    expect(postVisibility).toHaveBeenCalledTimes(2);

    focused = true;
    window.dispatchEvent(new Event('focus'));
    expect(postVisibility).toHaveBeenCalledTimes(3);

    focused = false;
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    expect(postVisibility).toHaveBeenCalledTimes(4);
  });
});
