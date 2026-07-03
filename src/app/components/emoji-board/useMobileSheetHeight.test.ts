import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMobileSheetHeights } from './mobileSheetHeights';
import { EmojiBoardTab } from './types';
import { useMobileSheetHeight } from './useMobileSheetHeight';

function setInnerHeight(height: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('useMobileSheetHeight', () => {
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    setInnerHeight(800);
  });

  afterEach(() => {
    setInnerHeight(originalInnerHeight);
  });

  it('computes the initial height as soon as the sheet is mobile + active', () => {
    const { result } = renderHook(() => useMobileSheetHeight(true, true, EmojiBoardTab.Emoji));
    const expected = getMobileSheetHeights(800, EmojiBoardTab.Emoji).initial;
    expect(result.current[0]).toBe(expected);
  });

  it('does not set a height when not a mobile sheet', () => {
    const { result } = renderHook(() => useMobileSheetHeight(false, true, EmojiBoardTab.Emoji));
    expect(result.current[0]).toBeUndefined();
  });

  it('does not set a height while inactive, even if isMobileSheet is true', () => {
    const { result } = renderHook(() => useMobileSheetHeight(true, false, EmojiBoardTab.Emoji));
    expect(result.current[0]).toBeUndefined();
  });

  it('does not reset a manually-set height when the sheet becomes inactive (no dismiss snap-back)', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useMobileSheetHeight(true, active, EmojiBoardTab.Emoji),
      { initialProps: { active: true } }
    );

    // Simulate a drag having moved the sheet to some arbitrary height.
    act(() => {
      result.current[1](333);
    });
    expect(result.current[0]).toBe(333);

    // Simulate a drag-to-dismiss: the parent flips `active` to false. The
    // height must stay exactly where the drag left it -- the close animation
    // is responsible for carrying it away, not a synchronous reset.
    rerender({ active: false });
    expect(result.current[0]).toBe(333);
  });

  it('recomputes a fresh initial height the next time the sheet re-opens, even on the same tab', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useMobileSheetHeight(true, active, EmojiBoardTab.Emoji),
      { initialProps: { active: true } }
    );

    act(() => {
      result.current[1](333);
    });
    rerender({ active: false });
    expect(result.current[0]).toBe(333);

    // Viewport changed while the sheet was closed (e.g. rotation) -- reopening
    // on the exact same tab should still pick up a fresh initial height
    // rather than reusing the stale dragged-to value.
    setInnerHeight(500);
    rerender({ active: true });
    expect(result.current[0]).toBe(getMobileSheetHeights(500, EmojiBoardTab.Emoji).initial);
  });

  it('recomputes on window resize while active', () => {
    const { result } = renderHook(() => useMobileSheetHeight(true, true, EmojiBoardTab.Gif));
    setInnerHeight(600);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current[0]).toBe(getMobileSheetHeights(600, EmojiBoardTab.Gif).initial);
  });
});
