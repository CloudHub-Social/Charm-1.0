import { describe, expect, it } from 'vitest';
import { shouldAutoExpandOnScroll } from './mobileSheetScrollExpand';
import type { MobileSheetHeights } from './mobileSheetHeights';

const heights: MobileSheetHeights = { min: 300, max: 600, initial: 420 };

describe('shouldAutoExpandOnScroll', () => {
  it('expands when scrolling down past the delta threshold while resting at min height', () => {
    expect(shouldAutoExpandOnScroll(40, 0, 300, heights, false)).toBe(true);
  });

  it('expands when resting a few px above min (rounding drift)', () => {
    expect(shouldAutoExpandOnScroll(40, 0, 302, heights, false)).toBe(true);
  });

  it('does not expand for a tiny/incidental scroll below the delta threshold', () => {
    expect(shouldAutoExpandOnScroll(10, 0, 300, heights, false)).toBe(false);
  });

  it('does not expand when the sheet is already above min height', () => {
    expect(shouldAutoExpandOnScroll(40, 0, 450, heights, false)).toBe(false);
  });

  it('does not expand while a manual drag is in progress', () => {
    expect(shouldAutoExpandOnScroll(40, 0, 300, heights, true)).toBe(false);
  });

  it('does not expand at zero scroll', () => {
    expect(shouldAutoExpandOnScroll(0, 0, 300, heights, false)).toBe(false);
  });

  it('does not expand on an upward scroll even if the absolute position is still elevated', () => {
    // Regression: the sheet was previously scrolled down to 200, then dragged
    // back to min height without the scroll position resetting. Scrolling
    // *up* from there (200 -> 190) must not re-trigger the expand just
    // because 190 alone would have cleared the old absolute threshold.
    expect(shouldAutoExpandOnScroll(190, 200, 300, heights, false)).toBe(false);
  });

  it('does not expand on a small downward wobble that stays under the delta threshold', () => {
    expect(shouldAutoExpandOnScroll(205, 200, 300, heights, false)).toBe(false);
  });

  it('expands on a genuine further downward scroll from an already-elevated position', () => {
    expect(shouldAutoExpandOnScroll(230, 200, 300, heights, false)).toBe(true);
  });
});
