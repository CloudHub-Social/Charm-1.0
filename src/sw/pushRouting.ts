import {
  DEFAULT_NOTIFICATION_BADGE,
  DEFAULT_NOTIFICATION_ICON,
} from '../app/utils/notificationStyle';

export type DeclarativeWebPushPayload = {
  web_push: 8030;
  notification: {
    title: string;
    body?: string;
    navigate?: string;
    app_badge?: number | string;
    tag?: string;
    icon?: string;
    badge?: string;
    image?: string;
    silent?: boolean;
    renotify?: boolean;
    data?: Record<string, unknown>;
  };
};

export function isMinimalPushPayload(data: unknown): data is { room_id: string; event_id: string } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.room_id === 'string' && typeof d.event_id === 'string' && !d.type;
}

export function isDeclarativeWebPushPayload(data: unknown): data is DeclarativeWebPushPayload {
  if (!data || typeof data !== 'object') return false;
  const payload = data as Record<string, unknown>;
  if (payload.web_push !== 8030) return false;
  const notification = payload.notification;
  if (!notification || typeof notification !== 'object') return false;
  return typeof (notification as Record<string, unknown>).title === 'string';
}

export type EncryptedMinimalPushFocusDecision = 'ignore_stale_focus' | 'no_focused_client';

export type DelayedPushQueueEntry = {
  payload: unknown;
  releaseAt: number;
  queuedAt: number;
  userId?: string;
  eventId?: string;
};

export function getEncryptedMinimalPushFocusDecision(
  focusedClientCount: number
): EncryptedMinimalPushFocusDecision {
  return focusedClientCount > 0 ? 'ignore_stale_focus' : 'no_focused_client';
}

export type ForegroundPushState = {
  visibilityState?: string;
  focused?: boolean;
};

export function shouldSuppressOsPushForForegroundState(
  state: ForegroundPushState | undefined
): boolean {
  return state?.visibilityState === 'visible' && state.focused === true;
}

export function extractPushEventId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const payload = data as {
    event_id?: unknown;
    notification?: { event_id?: unknown; data?: { event_id?: unknown } };
    data?: { event_id?: unknown };
  };
  if (typeof payload.event_id === 'string') return payload.event_id;
  if (typeof payload.notification?.event_id === 'string') return payload.notification.event_id;
  if (typeof payload.notification?.data?.event_id === 'string') {
    return payload.notification.data.event_id;
  }
  if (typeof payload.data?.event_id === 'string') return payload.data.event_id;
  return undefined;
}

export function extractPushUserId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const payload = data as {
    user_id?: unknown;
    notification?: { user_id?: unknown; data?: { user_id?: unknown } };
    data?: { user_id?: unknown };
  };
  if (typeof payload.user_id === 'string') return payload.user_id;
  if (typeof payload.notification?.user_id === 'string') return payload.notification.user_id;
  if (typeof payload.notification?.data?.user_id === 'string')
    return payload.notification.data.user_id;
  if (typeof payload.data?.user_id === 'string') return payload.data.user_id;
  return undefined;
}

export function extractPushRoomId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const payload = data as {
    room_id?: unknown;
    notification?: { room_id?: unknown; data?: { room_id?: unknown } };
    data?: { room_id?: unknown };
  };
  if (typeof payload.room_id === 'string') return payload.room_id;
  if (typeof payload.notification?.room_id === 'string') return payload.notification.room_id;
  if (typeof payload.notification?.data?.room_id === 'string')
    return payload.notification.data.room_id;
  if (typeof payload.data?.room_id === 'string') return payload.data.room_id;
  return undefined;
}

export function resolvePushUnreadCount(data: unknown): number | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const payload = data as {
    unread?: unknown;
    counts?: { unread?: unknown };
    notification?: { app_badge?: unknown; data?: { unread?: unknown } };
    data?: { unread?: unknown };
  };
  if (typeof payload.unread === 'number' && Number.isFinite(payload.unread)) return payload.unread;
  if (typeof payload.counts?.unread === 'number' && Number.isFinite(payload.counts.unread)) {
    return payload.counts.unread;
  }
  if (
    typeof payload.notification?.data?.unread === 'number' &&
    Number.isFinite(payload.notification.data.unread)
  ) {
    return payload.notification.data.unread;
  }
  if (typeof payload.data?.unread === 'number' && Number.isFinite(payload.data.unread)) {
    return payload.data.unread;
  }
  if (
    typeof payload.notification?.app_badge === 'number' &&
    Number.isFinite(payload.notification.app_badge)
  ) {
    return payload.notification.app_badge;
  }
  return undefined;
}

export function isCountOnlyReadStatePush(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  if (isDeclarativeWebPushPayload(data) || isMinimalPushPayload(data)) return false;
  return extractPushEventId(data) === undefined && !isForegroundSuppressionExemptPushPayload(data);
}

export function upsertDelayedPushQueueEntry(
  queue: DelayedPushQueueEntry[],
  payload: unknown,
  releaseAt: number,
  queuedAt: number
): DelayedPushQueueEntry[] {
  const eventId = extractPushEventId(payload);
  const userId = extractPushUserId(payload);
  const nextQueue = queue.filter(
    (entry) =>
      !(eventId && entry.eventId === eventId) &&
      !(JSON.stringify(entry.payload) === JSON.stringify(payload))
  );
  nextQueue.push({
    payload,
    releaseAt,
    queuedAt,
    userId,
    eventId,
  });
  nextQueue.sort((left, right) => {
    if (left.releaseAt !== right.releaseAt) return left.releaseAt - right.releaseAt;
    return left.queuedAt - right.queuedAt;
  });
  return nextQueue;
}

export function nextDelayedPushReleaseAt(queue: DelayedPushQueueEntry[]): number | undefined {
  return queue.reduce<number | undefined>((earliest, entry) => {
    if (earliest === undefined || entry.releaseAt < earliest) return entry.releaseAt;
    return earliest;
  }, undefined);
}

function resolvePushNotificationData(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  if (isDeclarativeWebPushPayload(data)) {
    const notificationData = data.notification.data;
    return notificationData && typeof notificationData === 'object' ? notificationData : undefined;
  }
  return data as Record<string, unknown>;
}

export function isForegroundSuppressionExemptPushPayload(data: unknown): boolean {
  const payload = resolvePushNotificationData(data);
  if (!payload) return false;

  const { type, content } = payload;
  if (type === 'org.matrix.msc4075.call.notify') return true;
  if (type === 'org.matrix.msc4075.rtc.notification') return true;

  return (
    type === 'm.room.member' &&
    !!content &&
    typeof content === 'object' &&
    (content as Record<string, unknown>).membership === 'invite'
  );
}

export function buildDeclarativeNotificationOptions(payload: DeclarativeWebPushPayload): {
  title: string;
  options: NotificationOptions;
} {
  const { notification } = payload;
  const data =
    notification.data && typeof notification.data === 'object'
      ? { ...notification.data, navigate: notification.navigate }
      : { navigate: notification.navigate };

  const options = {
    body: notification.body,
    icon: notification.icon ?? DEFAULT_NOTIFICATION_ICON,
    badge: notification.badge ?? DEFAULT_NOTIFICATION_BADGE,
    image: notification.image,
    tag: notification.tag,
    renotify: notification.renotify,
    silent: notification.silent,
    data,
  };

  return {
    title: notification.title,
    options: options as NotificationOptions,
  };
}
