import { describe, expect, it } from 'vitest';
import {
  getTimelineBottomScrollAction,
  getUnreadBridgeAction,
  shouldKeepBottomPinnedAfterJump,
} from './roomTimelineState';

describe('roomTimelineState', () => {
  it('keeps notification-live jumps pinned only when already linked to the live timeline', () => {
    expect(shouldKeepBottomPinnedAfterJump('notification_live', true)).toBe(true);
    expect(shouldKeepBottomPinnedAfterJump('notification_live', false)).toBe(false);
    expect(shouldKeepBottomPinnedAfterJump('history_context', true)).toBe(false);
  });

  it('continues unread-bridge pagination until live timeline is reached or retries are exhausted', () => {
    expect(
      getUnreadBridgeAction({
        active: true,
        liveTimelineLinked: false,
        forwardStatus: 'idle',
        attempts: 4,
      })
    ).toBe('paginate');

    expect(
      getUnreadBridgeAction({
        active: true,
        liveTimelineLinked: true,
        forwardStatus: 'idle',
        attempts: 4,
      })
    ).toBe('complete');

    expect(
      getUnreadBridgeAction({
        active: true,
        liveTimelineLinked: false,
        forwardStatus: 'idle',
        attempts: 12,
      })
    ).toBe('stop');
  });

  it('keeps the user pinned when media growth or viewport churn would otherwise surface Jump to Latest', () => {
    expect(
      getTimelineBottomScrollAction({
        atBottom: true,
        isNowAtBottom: false,
        contentGrew: true,
        viewportChanged: false,
        withinSettleWindow: false,
        withinViewportChangeWindow: false,
      })
    ).toBe('chase_bottom');

    expect(
      getTimelineBottomScrollAction({
        atBottom: true,
        isNowAtBottom: false,
        contentGrew: false,
        viewportChanged: true,
        withinSettleWindow: true,
        withinViewportChangeWindow: true,
      })
    ).toBe('chase_bottom');
  });

  it('only flips at-bottom state after a real scroll leaves the settle window', () => {
    expect(
      getTimelineBottomScrollAction({
        atBottom: true,
        isNowAtBottom: false,
        contentGrew: false,
        viewportChanged: false,
        withinSettleWindow: false,
        withinViewportChangeWindow: false,
      })
    ).toBe('update_at_bottom');

    expect(
      getTimelineBottomScrollAction({
        atBottom: false,
        isNowAtBottom: true,
        contentGrew: false,
        viewportChanged: true,
        withinSettleWindow: false,
        withinViewportChangeWindow: true,
      })
    ).toBe('ignore');
  });
});
