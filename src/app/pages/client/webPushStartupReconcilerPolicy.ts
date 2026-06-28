import {
  shouldEnableNotificationPusher,
  type NotificationDeviceScopeState,
} from '$hooks/useNotificationDeviceScope';

type WebPushStartupReconcilerPolicyInput = {
  userId: string | null;
  usePushNotifications: boolean;
  isTauriRuntime: boolean;
  webPushSupported: boolean;
  visibilityState: DocumentVisibilityState;
  isMobile: boolean;
  notificationDeviceScope: NotificationDeviceScopeState['notificationDeviceScope'];
  isActiveNotificationClient: boolean;
};

export type WebPushStartupReconcilerPolicy = {
  shouldReconcile: boolean;
  shouldEnablePusher: boolean;
  reconcileKey: string | null;
};

export function resolveWebPushStartupReconcilerPolicy({
  userId,
  usePushNotifications,
  isTauriRuntime,
  webPushSupported,
  visibilityState,
  isMobile,
  notificationDeviceScope,
  isActiveNotificationClient,
}: WebPushStartupReconcilerPolicyInput): WebPushStartupReconcilerPolicy {
  const shouldEnablePusher = shouldEnableNotificationPusher(
    visibilityState === 'visible',
    isMobile,
    notificationDeviceScope,
    isActiveNotificationClient
  );

  if (!usePushNotifications || isTauriRuntime || !webPushSupported || !userId) {
    return {
      shouldReconcile: false,
      shouldEnablePusher,
      reconcileKey: null,
    };
  }

  return {
    shouldReconcile: true,
    shouldEnablePusher,
    reconcileKey: [userId, visibilityState, shouldEnablePusher ? 'enabled' : 'disabled'].join(':'),
  };
}
