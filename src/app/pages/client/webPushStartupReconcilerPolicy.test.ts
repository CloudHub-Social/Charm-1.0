import { describe, expect, it } from 'vitest';
import { resolveWebPushStartupReconcilerPolicy } from './webPushStartupReconcilerPolicy';

describe('resolveWebPushStartupReconcilerPolicy', () => {
  it('skips reconciliation when push is disabled while still deriving the pusher state', () => {
    expect(
      resolveWebPushStartupReconcilerPolicy({
        userId: '@evie:example.com',
        usePushNotifications: false,
        isTauriRuntime: false,
        webPushSupported: true,
        visibilityState: 'visible',
        isMobile: false,
        notificationDeviceScope: 'all_clients',
        isActiveNotificationClient: true,
      })
    ).toEqual({
      shouldReconcile: false,
      shouldEnablePusher: true,
      reconcileKey: null,
    });
  });

  it('builds an enabled reconciliation key for a visible active client', () => {
    expect(
      resolveWebPushStartupReconcilerPolicy({
        userId: '@evie:example.com',
        usePushNotifications: true,
        isTauriRuntime: false,
        webPushSupported: true,
        visibilityState: 'visible',
        isMobile: false,
        notificationDeviceScope: 'active_client_only',
        isActiveNotificationClient: true,
      })
    ).toEqual({
      shouldReconcile: true,
      shouldEnablePusher: true,
      reconcileKey: '@evie:example.com:visible:enabled',
    });
  });

  it('builds a disabled reconciliation key for a hidden inactive desktop client', () => {
    expect(
      resolveWebPushStartupReconcilerPolicy({
        userId: '@evie:example.com',
        usePushNotifications: true,
        isTauriRuntime: false,
        webPushSupported: true,
        visibilityState: 'hidden',
        isMobile: false,
        notificationDeviceScope: 'active_client_only',
        isActiveNotificationClient: false,
      })
    ).toEqual({
      shouldReconcile: true,
      shouldEnablePusher: false,
      reconcileKey: '@evie:example.com:hidden:disabled',
    });
  });

  it('skips reconciliation when the session has no user id', () => {
    expect(
      resolveWebPushStartupReconcilerPolicy({
        userId: null,
        usePushNotifications: true,
        isTauriRuntime: false,
        webPushSupported: true,
        visibilityState: 'visible',
        isMobile: true,
        notificationDeviceScope: 'active_client_only',
        isActiveNotificationClient: false,
      })
    ).toEqual({
      shouldReconcile: false,
      shouldEnablePusher: true,
      reconcileKey: null,
    });
  });
});
