import { describe, expect, it } from 'vitest';
import { shouldAutoExpandOnScroll } from './mobileSheetScrollExpand';
import type { MobileSheetHeights } from './mobileSheetHeights';

const heights: MobileSheetHeights = { min: 300, max: 600, initial: 420 };

describe('shouldAutoExpandOnScroll', () => {
  it('expands when scrolled past the threshold while resting at min height', () => {
    expect(shouldAutoExpandOnScroll(40, 300, heights, false)).toBe(true);
  });

  it('expands when resting a few px above min (rounding drift)', () => {
    expect(shouldAutoExpandOnScroll(40, 302, heights, false)).toBe(true);
  });

  it('does not expand for a tiny/incidental scroll below the threshold', () => {
    expect(shouldAutoExpandOnScroll(10, 300, heights, false)).toBe(false);
  });

  it('does not expand when the sheet is already above min height', () => {
    expect(shouldAutoExpandOnScroll(40, 450, heights, false)).toBe(false);
  });

  it('does not expand while a manual drag is in progress', () => {
    expect(shouldAutoExpandOnScroll(40, 300, heights, true)).toBe(false);
  });

  it('does not expand at zero scroll', () => {
    expect(shouldAutoExpandOnScroll(0, 300, heights, false)).toBe(false);
  });
});
