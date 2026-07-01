import type { MobileSheetHeights } from './mobileSheetHeights';

// Pulling the drag handle this far past the min height dismisses the sheet.
export const DISMISS_PULL_PX = 80;
// A downward flick (px/ms) near the min height also dismisses the sheet,
// even if the drag distance itself was short.
export const DISMISS_VELOCITY = 0.5;

export type MobileSheetDragState = {
  rawHeight: number;
  velocityY: number;
  currentHeight: number;
};

// Extracted from the pointerup handler in EmojiBoard so the drag-to-dismiss
// thresholds have direct unit coverage instead of only being reachable
// through simulated pointer events on the full component tree.
export function shouldDismissMobileSheet(
  drag: MobileSheetDragState,
  heights: MobileSheetHeights
): boolean {
  const pulledPastMin = drag.rawHeight < heights.min - DISMISS_PULL_PX;
  const flickedDownNearMin =
    drag.velocityY > DISMISS_VELOCITY && drag.currentHeight <= heights.min + 40;
  return pulledPastMin || flickedDownNearMin;
}
