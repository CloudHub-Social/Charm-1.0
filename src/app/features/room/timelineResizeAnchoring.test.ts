import { describe, expect, it } from 'vitest';
import { getTimelineResizeAnchorTarget } from './timelineResizeAnchoring';

describe('timelineResizeAnchoring', () => {
  it('keeps a highlighted focus item centered while settle protection is active', () => {
    expect(
      getTimelineResizeAnchorTarget({
        atBottom: false,
        focusItem: { highlight: true },
        bottomSettleUntil: 0,
        focusSettleUntil: 2_000,
        now: 1_500,
      })
    ).toBe('focus');
  });

  it('falls back to bottom pinning once the focus settle window expires', () => {
    expect(
      getTimelineResizeAnchorTarget({
        atBottom: true,
        focusItem: { highlight: true },
        bottomSettleUntil: 2_000,
        focusSettleUntil: 1_000,
        now: 1_500,
      })
    ).toBe('bottom');
  });

  it('keeps live-bottom rooms pinned only during the bottom settle window', () => {
    expect(
      getTimelineResizeAnchorTarget({
        atBottom: true,
        bottomSettleUntil: 2_000,
        focusSettleUntil: 0,
        now: 1_500,
      })
    ).toBe('bottom');
  });

  it('does not fight off-bottom readers without an active focus settle window', () => {
    expect(
      getTimelineResizeAnchorTarget({
        atBottom: false,
        focusItem: { highlight: true },
        bottomSettleUntil: 0,
        focusSettleUntil: 1_000,
        now: 1_500,
      })
    ).toBeUndefined();
  });
});
