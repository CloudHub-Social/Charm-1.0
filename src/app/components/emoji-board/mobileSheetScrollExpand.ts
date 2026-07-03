import type { MobileSheetHeights } from './mobileSheetHeights';

// Scrolling down by at least this much between two consecutive scroll events
// counts as a deliberate "browse more" gesture, not incidental overscroll
// bounce or a scroll in the other direction. Comparing a delta (rather than
// the absolute scrollTop) means a stale-but-elevated scroll position left
// over from before the sheet was last dragged back to min height doesn't
// falsely count as "still scrolling down".
export const AUTO_EXPAND_SCROLL_DELTA_PX = 24;
// How close to the min height still counts as "at min" -- heights are
// recomputed per-render from the viewport, so treat a few px of drift as
// still being at rest rather than mid-drag.
export const NEAR_MIN_HEIGHT_EPSILON_PX = 4;

// Extracted from EmojiBoard's scroll listener so the "does this scroll
// trigger an auto-expand" decision has direct unit coverage, matching the
// mobileSheetDismiss.ts / mobileSheetHeights.ts pattern.
export function shouldAutoExpandOnScroll(
  scrollTop: number,
  previousScrollTop: number,
  currentHeight: number,
  heights: MobileSheetHeights,
  isDragging: boolean
): boolean {
  if (isDragging) return false;
  if (scrollTop - previousScrollTop < AUTO_EXPAND_SCROLL_DELTA_PX) return false;
  return currentHeight <= heights.min + NEAR_MIN_HEIGHT_EPSILON_PX;
}
