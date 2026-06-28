import { NotificationType } from '$types/matrix/room';

type PushActionLike = {
  notify?: boolean;
  tweaks?: {
    highlight?: unknown;
    sound?: unknown;
  };
};

export type MessageNotificationPolicyInput = {
  allowByFocusMode: boolean;
  backgroundNotificationSounds: boolean;
  hasSystemPermission: boolean;
  isDM: boolean;
  isMobileDevice: boolean;
  notificationSound: boolean;
  notificationType: NotificationType;
  pushActions?: PushActionLike | null;
  showNotifications: boolean;
  showSystemNotifications: boolean;
  tabVisible: boolean;
};

export type MessageNotificationPolicy = {
  isHighlight: boolean;
  isLoud: boolean;
  shouldPlaySound: boolean;
  shouldShowBanner: boolean;
  shouldShowSystemNotification: boolean;
  silent: boolean;
};

export const isHistoricalMessageNotificationEvent = ({
  clientStartTime,
  eventTs,
  hasUserReadReceipt,
  liveEvent,
}: {
  clientStartTime: number;
  eventTs: number;
  hasUserReadReceipt: boolean;
  liveEvent: boolean;
}): boolean => !liveEvent && (eventTs < clientStartTime - 60 * 1000 || hasUserReadReceipt);

export const resolveMessageNotificationPolicy = (
  input: MessageNotificationPolicyInput
): MessageNotificationPolicy | null => {
  const {
    allowByFocusMode,
    backgroundNotificationSounds,
    hasSystemPermission,
    isDM,
    isMobileDevice,
    notificationSound,
    notificationType,
    pushActions,
    showNotifications,
    showSystemNotifications,
    tabVisible,
  } = input;

  if (notificationType === NotificationType.Mute) return null;

  const shouldForceDMNotification =
    isDM && notificationType !== NotificationType.MentionsAndKeywords;
  const shouldForceRoomLoudNotification =
    !isDM && notificationType === NotificationType.AllMessages;
  const shouldNotify =
    pushActions?.notify === true || shouldForceDMNotification || shouldForceRoomLoudNotification;
  if (!shouldNotify || !allowByFocusMode) return null;

  const isHighlight = Boolean(pushActions?.tweaks?.highlight);
  const isLoud = Boolean(pushActions?.tweaks?.sound) || isDM || shouldForceRoomLoudNotification;
  const shouldAllowSound = notificationSound && isLoud;
  const shouldPlaySound = shouldAllowSound && (tabVisible || backgroundNotificationSounds);
  const silent = !shouldAllowSound || (!tabVisible && !backgroundNotificationSounds);

  return {
    isHighlight,
    isLoud,
    shouldPlaySound,
    shouldShowBanner: tabVisible && showNotifications && (isHighlight || isDM || isLoud),
    shouldShowSystemNotification: !isMobileDevice && showSystemNotifications && hasSystemPermission,
    silent,
  };
};
