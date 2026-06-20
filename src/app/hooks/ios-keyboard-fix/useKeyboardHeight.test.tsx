import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardHeight } from './useKeyboardHeight';

type ResizeListener = () => void;

describe('useKeyboardHeight', () => {
  let resizeListeners: ResizeListener[];
  let scrollListeners: ResizeListener[];
  let viewportHeight: number;

  beforeEach(() => {
    vi.useFakeTimers();
    resizeListeners = [];
    scrollListeners = [];
    viewportHeight = 500;

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        get height() {
          return viewportHeight;
        },
        addEventListener: vi.fn<(event: string, listener: ResizeListener) => void>(
          (event: string, listener: ResizeListener) => {
          if (event === 'resize') resizeListeners.push(listener);
          if (event === 'scroll') scrollListeners.push(listener);
          }
        ),
        removeEventListener: vi.fn<(event: string, listener: ResizeListener) => void>(
          (event: string, listener: ResizeListener) => {
          if (event === 'resize') {
            resizeListeners = resizeListeners.filter((candidate) => candidate !== listener);
          }
          if (event === 'scroll') {
            scrollListeners = scrollListeners.filter((candidate) => candidate !== listener);
          }
          }
        ),
      },
    });

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => document.body,
    });

    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    document.documentElement.style.removeProperty('--sable-visible-height');
    document.documentElement.style.removeProperty('--sable-safe-bottom');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.documentElement.style.removeProperty('--sable-visible-height');
    document.documentElement.style.removeProperty('--sable-safe-bottom');
  });

  it('does not clear shared keyboard CSS vars when a second hook instance mounts', () => {
    renderHook(() => useKeyboardHeight());

    act(() => {
      resizeListeners.forEach((listener) => listener());
      vi.advanceTimersByTime(100);
    });

    expect(document.documentElement.style.getPropertyValue('--sable-visible-height')).toBe('500px');

    renderHook(() => useKeyboardHeight());

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(document.documentElement.style.getPropertyValue('--sable-visible-height')).toBe('500px');
  });
});
