import { describe, expect, it, vi } from 'vitest';
import { createPushNotifications } from './pushNotification';

describe('createPushNotifications', () => {
  it('uses decrypted effective types for encrypted push previews', async () => {
    const showNotification = vi
      .fn<(title: string, options?: NotificationOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const handle = createPushNotifications(
      {
        registration: { showNotification },
      } as unknown as ServiceWorkerGlobalScope,
      () => ({
        showMessageContent: true,
        showEncryptedMessageContent: true,
      }),
      vi.fn().mockResolvedValue(undefined)
    );

    await handle.handlePushNotificationPushData({
      type: 'm.room.encrypted',
      effectiveType: 'm.reaction',
      content: { 'm.relates_to': { key: '👍' } },
      sender_display_name: 'Alice',
      room_name: 'General',
      event_id: '$event',
      room_id: '!room:example.org',
      user_id: '@me:example.org',
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Alice in General • me',
      expect.objectContaining({
        body: 'Alice: Reacted with 👍',
      })
    );
  });

  it('accepts snake_case effective types from rich web-push payloads', async () => {
    const showNotification = vi
      .fn<(title: string, options?: NotificationOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const handle = createPushNotifications(
      {
        registration: { showNotification },
      } as unknown as ServiceWorkerGlobalScope,
      () => ({
        showMessageContent: true,
        showEncryptedMessageContent: true,
      }),
      vi.fn().mockResolvedValue(undefined)
    );

    await handle.handlePushNotificationPushData({
      type: 'm.room.encrypted',
      effective_type: 'm.reaction',
      content: { 'm.relates_to': { key: '👍' } },
      sender_display_name: 'Alice',
      room_name: 'General',
      event_id: '$event',
      room_id: '!room:example.org',
      user_id: '@me:example.org',
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Alice in General • me',
      expect.objectContaining({
        body: 'Alice: Reacted with 👍',
      })
    );
  });

  it('dispatches direct reaction push payloads', async () => {
    const showNotification = vi
      .fn<(title: string, options?: NotificationOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const handle = createPushNotifications(
      {
        registration: { showNotification },
      } as unknown as ServiceWorkerGlobalScope,
      () => ({
        showMessageContent: true,
        showEncryptedMessageContent: true,
      }),
      vi.fn().mockResolvedValue(undefined)
    );

    await handle.handlePushNotificationPushData({
      type: 'm.reaction',
      content: { 'm.relates_to': { key: '👍' } },
      sender_display_name: 'Alice',
      room_name: 'General',
      event_id: '$event',
      room_id: '!room:example.org',
      user_id: '@me:example.org',
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Alice in General • me',
      expect.objectContaining({
        body: 'Alice: Reacted with 👍',
      })
    );
  });

  it('dispatches encrypted call notifications using the decrypted effective type', async () => {
    const showNotification = vi
      .fn<(title: string, options?: NotificationOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const handle = createPushNotifications(
      {
        registration: { showNotification },
      } as unknown as ServiceWorkerGlobalScope,
      () => ({
        showMessageContent: true,
        showEncryptedMessageContent: true,
      }),
      vi.fn().mockResolvedValue(undefined)
    );

    await handle.handlePushNotificationPushData({
      type: 'm.room.encrypted',
      effectiveType: 'org.matrix.msc4075.call.notify',
      content: { notification_type: 'ring' },
      sender_display_name: 'Alice',
      room_name: 'General',
      room_id: '!room:example.org',
      user_id: '@me:example.org',
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Incoming voice call',
      expect.objectContaining({
        body: 'Alice is calling you in General',
      })
    );
  });

  it('does not show a notification for a call push that already expired', async () => {
    const showNotification = vi
      .fn<(title: string, options?: NotificationOptions) => Promise<void>>()
      .mockResolvedValue(undefined);
    const handle = createPushNotifications(
      {
        registration: { showNotification },
      } as unknown as ServiceWorkerGlobalScope,
      () => ({
        showMessageContent: true,
        showEncryptedMessageContent: true,
      }),
      vi.fn().mockResolvedValue(undefined)
    );

    await handle.handlePushNotificationPushData({
      type: 'org.matrix.msc4075.rtc.notification',
      content: {
        notification_type: 'ring',
        // Delivered long after the call's own 30s lifetime elapsed (device asleep,
        // delayed push delivery, etc.) — should not be shown at all.
        sender_ts: Date.now() - 120_000,
        lifetime: 30_000,
      },
      sender_display_name: 'Alice',
      room_name: 'General',
      room_id: '!room:example.org',
      user_id: '@me:example.org',
      timestamp: Date.now() - 120_000,
    });

    expect(showNotification).not.toHaveBeenCalled();
  });
});
