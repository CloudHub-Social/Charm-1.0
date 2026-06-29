import { describe, expect, it } from 'vitest';
import { EmojiBoardTab } from './types';
import { getMobileSheetHeights } from './mobileSheetHeights';

describe('getMobileSheetHeights', () => {
  describe('GIF tab', () => {
    it('normal tall viewport: initial fits between min and max', () => {
      const h = getMobileSheetHeights(844, EmojiBoardTab.Gif);
      expect(h.initial).toBeGreaterThanOrEqual(h.min);
      expect(h.initial).toBeLessThanOrEqual(h.max);
      expect(h.max).toBeGreaterThanOrEqual(h.min);
    });

    it('short landscape viewport (420px): initial does not exceed max', () => {
      // maxHeight = max(360, min(348, 378)) = 360
      // initial unclamped = max(380, min(360, 327.6)) = 380 — would exceed max without clamp
      const h = getMobileSheetHeights(420, EmojiBoardTab.Gif);
      expect(h.initial).toBeLessThanOrEqual(h.max);
      expect(h.initial).toBeGreaterThanOrEqual(h.min);
    });

    it('very short viewport (380px): initial clamped to max', () => {
      const h = getMobileSheetHeights(380, EmojiBoardTab.Gif);
      expect(h.initial).toBeLessThanOrEqual(h.max);
      expect(h.initial).toBeGreaterThanOrEqual(h.min);
    });

    it('min is always <= max', () => {
      [300, 380, 420, 600, 844, 1024].forEach((vh) => {
        const h = getMobileSheetHeights(vh, EmojiBoardTab.Gif);
        expect(h.min).toBeLessThanOrEqual(h.max);
      });
    });
  });

  describe('Emoji/Sticker tab', () => {
    it('normal viewport: initial fits within [min, max]', () => {
      const h = getMobileSheetHeights(844, EmojiBoardTab.Emoji);
      expect(h.initial).toBeGreaterThanOrEqual(h.min);
      expect(h.initial).toBeLessThanOrEqual(h.max);
    });

    it('short viewport: initial does not exceed max', () => {
      const h = getMobileSheetHeights(420, EmojiBoardTab.Emoji);
      expect(h.initial).toBeLessThanOrEqual(h.max);
    });

    it('min is always <= max', () => {
      [300, 380, 420, 600, 844].forEach((vh) => {
        const h = getMobileSheetHeights(vh, EmojiBoardTab.Emoji);
        expect(h.min).toBeLessThanOrEqual(h.max);
      });
    });
  });
});
