import { describe, expect, it } from 'vitest';
import {
  buildDeclarativeNotificationOptions,
  extractPushEventId,
  extractPushRoomId,
  extractPushUserId,
  getEncryptedMinimalPushFocusDecision,
  isCountOnlyReadStatePush,
  isForegroundSuppressionExemptPushPayload,
  isDeclarativeWebPushPayload,
  isMinimalPushPayload,
  nextDelayedPushReleaseAt,
  resolvePushUnreadCount,
  shouldSuppressOsPushForForegroundState,
  upsertDelayedPushQueueEntry,
} from './pushRouting';

describe('service worker push routing helpers', () => {
  it('detects event_id_only minimal push payloads', () => {
    expect(isMinimalPushPayload({ room_id: '!room:example', event_id: '$event' })).toBe(true);
    expect(
      isMinimalPushPayload({ room_id: '!room:example', event_id: '$event', type: 'm.room.message' })
    ).toBe(false);
  });

  it('detects and maps declarative web push payloads', () => {
    const payload = {
      web_push: 8030,
      notification: {
        title: 'Charm',
        body: 'New message',
        navigate: '/to/%40alice%3Aexample/%21room%3Aexample',
        app_badge: 4,
        data: {
          room_id: '!room:example',
          event_id: '$event',
          user_id: '@alice:example',
        },
      },
    } as const;

    expect(isDeclarativeWebPushPayload(payload)).toBe(true);

    const { title, options } = buildDeclarativeNotificationOptions(payload);
    expect(title).toBe('Charm');
    expect(options.body).toBe('New message');
    expect(options.data).toMatchObject({
      navigate: '/to/%40alice%3Aexample/%21room%3Aexample',
      room_id: '!room:example',
      event_id: '$event',
      user_id: '@alice:example',
    });
  });

  it('ignores focused clients for encrypted minimal push suppression', () => {
    expect(getEncryptedMinimalPushFocusDecision(0)).toBe('no_focused_client');
    expect(getEncryptedMinimalPushFocusDecision(1)).toBe('ignore_stale_focus');
  });

  it('suppresses OS push only when a live client confirms visible focused foreground state', () => {
    expect(
      shouldSuppressOsPushForForegroundState({ visibilityState: 'visible', focused: true })
    ).toBe(true);
    expect(
      shouldSuppressOsPushForForegroundState({ visibilityState: 'visible', focused: false })
    ).toBe(false);
    expect(shouldSuppressOsPushForForegroundState({ visibilityState: 'hidden' })).toBe(false);
    expect(shouldSuppressOsPushForForegroundState(undefined)).toBe(false);
  });

  it('exempts call pushes and invites from foreground suppression', () => {
    expect(
      isForegroundSuppressionExemptPushPayload({
        type: 'org.matrix.msc4075.call.notify',
        content: { notification_type: 'ring' },
      })
    ).toBe(true);
    expect(
      isForegroundSuppressionExemptPushPayload({
        type: 'm.room.member',
        content: { membership: 'invite' },
      })
    ).toBe(true);
    expect(
      isForegroundSuppressionExemptPushPayload({
        web_push: 8030,
        notification: {
          title: 'Charm',
          data: {
            type: 'm.room.member',
            content: { membership: 'invite' },
          },
        },
      })
    ).toBe(true);
    expect(
      isForegroundSuppressionExemptPushPayload({
        type: 'm.room.message',
        content: { body: 'hello' },
      })
    ).toBe(false);
  });

  it('extracts nested push identifiers across payload shapes', () => {
    const payload = {
      web_push: 8030,
      notification: {
        title: 'Charm',
        data: {
          room_id: '!room:example',
          event_id: '$event',
          user_id: '@alice:example',
        },
      },
    } as const;

    expect(extractPushRoomId(payload)).toBe('!room:example');
    expect(extractPushEventId(payload)).toBe('$event');
    expect(extractPushUserId(payload)).toBe('@alice:example');
  });

  it('detects unread-count-only pushes but excludes actionable call/invite payloads', () => {
    expect(isCountOnlyReadStatePush({ unread: 0, room_id: '!room:example' })).toBe(true);
    expect(resolvePushUnreadCount({ counts: { unread: 3 } })).toBe(3);
    expect(
      isCountOnlyReadStatePush({
        unread: 1,
        type: 'org.matrix.msc4075.call.notify',
        content: { notification_type: 'ring' },
      })
    ).toBe(false);
    expect(
      isCountOnlyReadStatePush({
        unread: 1,
        type: 'm.room.member',
        content: { membership: 'invite' },
      })
    ).toBe(false);
  });

  it('deduplicates and orders delayed push queue entries deterministically', () => {
    const queue = upsertDelayedPushQueueEntry([], { event_id: '$late', user_id: '@a:hs' }, 30, 3);
    const next = upsertDelayedPushQueueEntry(
      queue,
      { event_id: '$early', user_id: '@a:hs' },
      10,
      1
    );
    const deduped = upsertDelayedPushQueueEntry(
      next,
      { event_id: '$late', user_id: '@a:hs', room_id: '!room:hs' },
      20,
      2
    );

    expect(deduped.map((entry) => entry.eventId)).toEqual(['$early', '$late']);
    expect(deduped[1]).toMatchObject({
      eventId: '$late',
      releaseAt: 20,
      queuedAt: 2,
      userId: '@a:hs',
    });
    expect(nextDelayedPushReleaseAt(deduped)).toBe(10);
  });
});
