/* oxlint-disable vitest/require-mock-type-parameters */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { EventType } from 'matrix-js-sdk/lib/@types/event';
import {
  clearRoomNotification,
  listenForUnifiedPushMessages,
} from './UnifiedPushRuntime';

const notificationsApi = vi.hoisted(() => ({
  onUnifiedPushMessage: vi.fn(),
  sendNotification: vi.fn(),
  removeActive: vi.fn(),
}));

const getTauriNotificationsApi = vi.hoisted(() => vi.fn().mockResolvedValue(notificationsApi));

vi.mock('./TauriNotificationsApiClient', () => ({
  getTauriNotificationsApi,
}));

vi.mock('$utils/notificationStyle', () => ({
  resolveNotificationPreviewText: ({ content }: { content?: { body?: string } }) =>
    content?.body ?? 'New message',
}));

function createEvent(eventId: string, senderId: string, body: string) {
  return {
    getId: () => eventId,
    getSender: () => senderId,
    getContent: () => ({ body }),
    getType: () => EventType.RoomMessage,
  };
}

describe('UnifiedPushRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTauriNotificationsApi.mockResolvedValue(notificationsApi);
  });

  afterEach(async () => {
    await clearRoomNotification('!room:example');
  });

  it('serializes minimal push notifications per room', async () => {
    let registeredListener: ((data: Record<string, unknown>) => void) | undefined;
    notificationsApi.onUnifiedPushMessage.mockImplementation((listener) => {
      registeredListener = listener;
      return () => undefined;
    });

    let releaseFirstSend: (() => void) | undefined;
    notificationsApi.sendNotification.mockImplementation(({ extra }) => {
      if (extra?.event_id === '$old') {
        return new Promise<void>((resolve) => {
          releaseFirstSend = resolve;
        });
      }
      return Promise.resolve();
    });

    const room = {
      name: 'Example Room',
      getLiveTimeline: () => ({
        getState: () => undefined,
        getEvents: () => [
          createEvent('$old', '@old:example', 'older message'),
          createEvent('$new', '@new:example', 'newer message'),
        ],
      }),
      getMember: (senderId: string) => ({
        name: senderId === '@old:example' ? 'Old' : senderId === '@new:example' ? 'New' : 'You',
        getMxcAvatarUrl: () => undefined,
      }),
      getJoinedMemberCount: () => 2,
    };

    const settings = {
      mx: {
        getRoom: (roomId: string) => (roomId === '!room:example' ? room : undefined),
        getUserId: () => '@me:example',
        getAccessToken: () => 'token',
        mxcUrlToHttp: () => undefined,
      },
      showMessageContent: true,
      showEncryptedMessageContent: false,
      notificationSoundEnabled: true,
      useInAppNotifications: false,
    };

    await listenForUnifiedPushMessages(() => settings as never);

    registeredListener?.({ room_id: '!room:example', event_id: '$old', counts: { unread: 2 } });
    registeredListener?.({ room_id: '!room:example', event_id: '$new', counts: { unread: 2 } });

    await waitFor(() => {
      expect(notificationsApi.sendNotification).toHaveBeenCalledTimes(1);
    });

    expect(notificationsApi.sendNotification.mock.calls[0]?.[0]).toMatchObject({
      body: 'Old: older message',
      extra: { room_id: '!room:example', event_id: '$old' },
    });

    releaseFirstSend?.();
    await waitFor(() => {
      expect(notificationsApi.sendNotification).toHaveBeenCalledTimes(2);
    });

    expect(notificationsApi.sendNotification.mock.calls[1]?.[0]).toMatchObject({
      body: 'New: newer message',
      extra: { room_id: '!room:example', event_id: '$new' },
    });
  });
});
