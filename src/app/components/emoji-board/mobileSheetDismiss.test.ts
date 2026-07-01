import { describe, expect, it } from 'vitest';
import { shouldDismissMobileSheet } from './mobileSheetDismiss';
import type { MobileSheetHeights } from './mobileSheetHeights';

const heights: MobileSheetHeights = { min: 300, max: 600, initial: 420 };

describe('shouldDismissMobileSheet', () => {
  it('dismisses when dragged well past the min height', () => {
    expect(
      shouldDismissMobileSheet({ rawHeight: 200, velocityY: 0, currentHeight: 300 }, heights)
    ).toBe(true);
  });

  it('does not dismiss for a small pull below min (should just snap to min)', () => {
    expect(
      shouldDismissMobileSheet({ rawHeight: 260, velocityY: 0, currentHeight: 300 }, heights)
    ).toBe(false);
  });

  it('dismisses on a fast downward flick near the min height', () => {
    expect(
      shouldDismissMobileSheet({ rawHeight: 310, velocityY: 0.8, currentHeight: 310 }, heights)
    ).toBe(true);
  });

  it('does not dismiss on a fast downward flick while still tall', () => {
    expect(
      shouldDismissMobileSheet({ rawHeight: 500, velocityY: 0.8, currentHeight: 500 }, heights)
    ).toBe(false);
  });

  it('does not dismiss on an upward flick even near min', () => {
    expect(
      shouldDismissMobileSheet({ rawHeight: 310, velocityY: -0.8, currentHeight: 310 }, heights)
    ).toBe(false);
  });

  it('does not dismiss while comfortably above min with no velocity', () => {
    expect(
      shouldDismissMobileSheet({ rawHeight: 450, velocityY: 0, currentHeight: 450 }, heights)
    ).toBe(false);
  });
});
