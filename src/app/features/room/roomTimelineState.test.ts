import { describe, expect, it } from 'vitest';
import {
  getTimelineBottomScrollAction,
  getUnreadBridgeAction,
  shouldKeepBottomPinnedAfterJump,
} from './roomTimelineState';

describe('roomTimelineState', () => {
  it('keeps notification-live jumps pinned only when already linked to the live timeline', () => {
    expect(shouldKeepBottomPinnedAfterJump(undefined, 'notification_live', true, 'end')).toBe(true);
    expect(shouldKeepBottomPinnedAfterJump(undefined, 'notification_live', true, 'center')).toBe(
      false
    );
    expect(shouldKeepBottomPinnedAfterJump(undefined, 'notification_live', false, 'end')).toBe(
      false
    );
    expect(shouldKeepBottomPinnedAfterJump(undefined, 'history_context', true, 'end')).toBe(false);
    expect(shouldKeepBottomPinnedAfterJump(true, 'history_context', false, 'center')).toBe(true);
  });

  it('continues unread-bridge pagination until live timeline is reached or retries are exhausted', () => {
    expect(
      getUnreadBridgeAction({
        active: true,
        awaitingContextLoad: false,
        liveTimelineLinked: false,
        reachedTarget: false,
        forwardStatus: 'idle',
        attempts: 4,
      })
    ).toBe('paginate');

    expect(
      getUnreadBridgeAction({
        active: true,
        awaitingContextLoad: false,
        liveTimelineLinked: true,
        reachedTarget: true,
        forwardStatus: 'idle',
        attempts: 4,
      })
    ).toBe('complete');

    expect(
      getUnreadBridgeAction({
        active: true,
        awaitingContextLoad: false,
        liveTimelineLinked: false,
        reachedTarget: false,
        forwardStatus: 'idle',
        attempts: 12,
      })
    ).toBe('stop');
  });

  it('does not complete unread bridging when the live timeline was restored without reaching the unread marker', () => {
    expect(
      getUnreadBridgeAction({
        active: true,
        awaitingContextLoad: false,
        liveTimelineLinked: true,
        reachedTarget: false,
        forwardStatus: 'idle',
        attempts: 1,
      })
    ).toBe('stop');
  });

  it('waits for unread context loading to finish before deciding whether to stop or paginate', () => {
    expect(
      getUnreadBridgeAction({
        active: true,
        awaitingContextLoad: true,
        liveTimelineLinked: true,
        reachedTarget: false,
        forwardStatus: 'idle',
        attempts: 0,
      })
    ).toBe('idle');

    expect(
      getUnreadBridgeAction({
        active: true,
        awaitingContextLoad: false,
        liveTimelineLinked: false,
        reachedTarget: false,
        forwardStatus: 'loading',
        attempts: 0,
      })
    ).toBe('idle');
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
