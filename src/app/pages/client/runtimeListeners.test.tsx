import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useServiceWorkerMessageListener,
  useVisibilityAndPageShowListeners,
  useVisibilityFocusBlurPageShowListeners,
} from './runtimeListeners';

describe('runtimeListeners', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn<(type: string, listener: EventListener) => void>(),
        removeEventListener: vi.fn<(type: string, listener: EventListener) => void>(),
      },
    });
  });

  afterEach(() => {
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
});
