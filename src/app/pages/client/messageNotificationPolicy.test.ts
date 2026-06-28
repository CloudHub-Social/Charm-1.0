import { describe, expect, it } from 'vitest';
import { NotificationType } from '$types/matrix/room';
import {
  isHistoricalMessageNotificationEvent,
  resolveMessageNotificationPolicy,
} from './messageNotificationPolicy';

describe('messageNotificationPolicy', () => {
  it('treats old non-live events and read-receipt-covered events as historical', () => {
    expect(
      isHistoricalMessageNotificationEvent({
        clientStartTime: 100_000,
        eventTs: 39_999,
        hasUserReadReceipt: false,
        liveEvent: false,
      })
    ).toBe(true);

    expect(
      isHistoricalMessageNotificationEvent({
        clientStartTime: 100_000,
        eventTs: 99_999,
        hasUserReadReceipt: true,
        liveEvent: false,
      })
    ).toBe(true);

    expect(
      isHistoricalMessageNotificationEvent({
        clientStartTime: 100_000,
        eventTs: 99_999,
        hasUserReadReceipt: false,
        liveEvent: true,
      })
    ).toBe(false);
  });

  it('forces DM notifications outside mentions-only mode when push rules miss', () => {
    expect(
      resolveMessageNotificationPolicy({
        allowByFocusMode: true,
        backgroundNotificationSounds: false,
        hasSystemPermission: true,
        isDM: true,
        isMobileDevice: false,
        notificationSound: true,
        notificationType: NotificationType.AllMessages,
        pushActions: { notify: false, tweaks: {} },
        showNotifications: true,
        showSystemNotifications: true,
        tabVisible: true,
      })
    ).toMatchObject({
      isHighlight: false,
      isLoud: true,
      shouldPlaySound: true,
      shouldShowBanner: true,
      shouldShowSystemNotification: true,
      silent: false,
    });
  });

  it('forces all-messages room notifications when push rules miss', () => {
    expect(
      resolveMessageNotificationPolicy({
        allowByFocusMode: true,
        backgroundNotificationSounds: false,
        hasSystemPermission: true,
        isDM: false,
        isMobileDevice: false,
        notificationSound: true,
        notificationType: NotificationType.AllMessages,
        pushActions: { notify: false, tweaks: {} },
        showNotifications: true,
        showSystemNotifications: true,
        tabVisible: true,
      })
    ).toMatchObject({
      isHighlight: false,
      isLoud: true,
      shouldPlaySound: true,
      shouldShowBanner: true,
      shouldShowSystemNotification: true,
      silent: false,
    });
  });

  it('keeps mentions-only DMs gated by push-rule notification matches', () => {
    expect(
      resolveMessageNotificationPolicy({
        allowByFocusMode: true,
        backgroundNotificationSounds: false,
        hasSystemPermission: true,
        isDM: true,
        isMobileDevice: false,
        notificationSound: true,
        notificationType: NotificationType.MentionsAndKeywords,
        pushActions: { notify: false, tweaks: {} },
        showNotifications: true,
        showSystemNotifications: true,
        tabVisible: true,
      })
    ).toBeNull();
  });

  it('suppresses delivery surfaces when focus mode rejects the notification', () => {
    expect(
      resolveMessageNotificationPolicy({
        allowByFocusMode: false,
        backgroundNotificationSounds: true,
        hasSystemPermission: true,
        isDM: false,
        isMobileDevice: false,
        notificationSound: true,
        notificationType: NotificationType.AllMessages,
        pushActions: { notify: true, tweaks: { highlight: true, sound: true } },
        showNotifications: true,
        showSystemNotifications: true,
        tabVisible: true,
      })
    ).toBeNull();
  });

  it('separates banner, sound, and system delivery from the same policy', () => {
    expect(
      resolveMessageNotificationPolicy({
        allowByFocusMode: true,
        backgroundNotificationSounds: true,
        hasSystemPermission: false,
        isDM: false,
        isMobileDevice: false,
        notificationSound: true,
        notificationType: NotificationType.AllMessages,
        pushActions: { notify: true, tweaks: { highlight: true, sound: true } },
        showNotifications: true,
        showSystemNotifications: true,
        tabVisible: false,
      })
    ).toEqual({
      isHighlight: true,
      isLoud: true,
      shouldPlaySound: true,
      shouldShowBanner: false,
      shouldShowSystemNotification: false,
      silent: false,
    });
  });

  it('keeps hidden-tab system notifications silent when background sounds are disabled', () => {
    expect(
      resolveMessageNotificationPolicy({
        allowByFocusMode: true,
        backgroundNotificationSounds: false,
        hasSystemPermission: true,
        isDM: false,
        isMobileDevice: false,
        notificationSound: true,
        notificationType: NotificationType.AllMessages,
        pushActions: { notify: false, tweaks: {} },
        showNotifications: true,
        showSystemNotifications: true,
        tabVisible: false,
      })
    ).toEqual({
      isHighlight: false,
      isLoud: true,
      shouldPlaySound: false,
      shouldShowBanner: false,
      shouldShowSystemNotification: true,
      silent: true,
    });
  });
});
