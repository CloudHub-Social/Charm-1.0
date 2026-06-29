import { EmojiBoardTab } from './types';

export type MobileSheetHeights = {
  min: number;
  max: number;
  initial: number;
};

export function getMobileSheetHeights(
  viewportHeight: number,
  tab: EmojiBoardTab
): MobileSheetHeights {
  const maxHeight = Math.max(360, Math.min(viewportHeight - 72, viewportHeight * 0.9));

  if (tab === EmojiBoardTab.Gif) {
    const max = maxHeight;
    const min = Math.max(340, Math.min(max - 80, viewportHeight * 0.58));
    return {
      min,
      max,
      // Clamp initial to [min, max] — on short viewports max can be < 380.
      initial: Math.max(min, Math.min(max, Math.max(380, viewportHeight * 0.78))),
    };
  }

  const max = Math.max(340, Math.min(maxHeight, viewportHeight * 0.7));
  const min = Math.max(300, Math.min(max - 60, viewportHeight * 0.46));
  return {
    min,
    max,
    initial: Math.max(min, Math.min(max, Math.max(320, viewportHeight * 0.56))),
  };
}
