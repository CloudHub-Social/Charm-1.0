import { describe, expect, it } from 'vitest';
import {
  buildEventTargetCleanupTarget,
  shouldCleanNotificationJumpOnBack,
} from './notificationJumpCleanup';

describe('notificationJumpCleanup', () => {
  it('only cleans transient notification jump routes on back', () => {
    expect(
      shouldCleanNotificationJumpOnBack({
        eventId: '$event',
        jumpMode: 'notification_live',
        pathname: '/direct/%21abc/%24event',
      })
    ).toBe(true);

    expect(
      shouldCleanNotificationJumpOnBack({
        eventId: '$event',
        jumpMode: 'notification_live',
        pathname: '/direct/%21abc/',
      })
    ).toBe(false);

    expect(
      shouldCleanNotificationJumpOnBack({
        eventId: '$event',
        jumpMode: 'history_context',
        pathname: '/direct/%21abc/%24event',
      })
    ).toBe(false);

    expect(
      shouldCleanNotificationJumpOnBack({
        eventId: undefined,
        jumpMode: 'notification_live',
        pathname: '/direct/%21abc/%24event',
      })
    ).toBe(false);
  });

  it('removes notification-only query params and strips the event segment', () => {
    expect(
      buildEventTargetCleanupTarget(
        '/direct/%21abc/%24event',
        '?jumpMode=notification_live&joinCall=true&via=push',
        '$event'
      )
    ).toBe('/direct/%21abc?via=push');
  });
});
