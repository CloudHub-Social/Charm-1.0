import type { MobileSheetHeights } from './mobileSheetHeights';

// Scrolling this far down inside the tab content counts as a deliberate
// "browse more" gesture, not incidental overscroll bounce.
export const AUTO_EXPAND_SCROLL_THRESHOLD_PX = 24;
// How close to the min height still counts as "at min" -- heights are
// recomputed per-render from the viewport, so treat a few px of drift as
// still being at rest rather than mid-drag.
export const NEAR_MIN_HEIGHT_EPSILON_PX = 4;

// Extracted from EmojiBoard's scroll listener so the "does this scroll
// trigger an auto-expand" decision has direct unit coverage, matching the
// mobileSheetDismiss.ts / mobileSheetHeights.ts pattern.
export function shouldAutoExpandOnScroll(
  scrollTop: number,
  currentHeight: number,
  heights: MobileSheetHeights,
  isDragging: boolean
): boolean {
  if (isDragging) return false;
  if (scrollTop < AUTO_EXPAND_SCROLL_THRESHOLD_PX) return false;
  return currentHeight <= heights.min + NEAR_MIN_HEIGHT_EPSILON_PX;
}
