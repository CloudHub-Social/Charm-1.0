import type { IncomingCall } from '$state/callEmbed';
import {
  MAX_CALL_NOTIFICATION_LIFETIME_MS,
  normalizeCallIntent,
  toCallNotificationTypeOrDefault,
} from './callIntent';
import { createDebugLogger } from '$utils/debugLogger';

const debugLog = createDebugLogger('CallSignaling');

type CallCandidate = {
  roomId: string;
  notificationEventId: string;
  notificationTypeRaw?: string;
  intentKindRaw?: string;
  intentRaw?: string;
  refEventIdRaw?: string;
  senderIdRaw?: string;
  senderTsRaw?: number;
  expiresAtRaw?: number;
  isDirect: boolean;
};

const fromCandidate = (candidate: CallCandidate, now = Date.now()): IncomingCall | undefined => {
  const notificationType = toCallNotificationTypeOrDefault(candidate.notificationTypeRaw);
  const senderTs =
    typeof candidate.senderTsRaw === 'number' && Number.isFinite(candidate.senderTsRaw)
      ? candidate.senderTsRaw
      : now;
  const expiresAt =
    typeof candidate.expiresAtRaw === 'number' && Number.isFinite(candidate.expiresAtRaw)
      ? candidate.expiresAtRaw
      : senderTs + MAX_CALL_NOTIFICATION_LIFETIME_MS;

  if (now >= expiresAt) return undefined;

  return {
    roomId: candidate.roomId,
    notificationEventId: candidate.notificationEventId,
    refEventId: candidate.refEventIdRaw || candidate.notificationEventId,
    senderId: candidate.senderIdRaw || 'unknown',
    senderTs,
    expiresAt,
    notificationType,
    intentKind: normalizeCallIntent(candidate.intentKindRaw, candidate.intentRaw),
    intentRaw: candidate.intentRaw,
    isDirect: candidate.isDirect,
  };
};

// Reads the same shape createPushNotifications' handleCallNotification builds as
// Notification.data (see sw/pushNotification.ts) — room_id/event_id/sender_id are
// snake_case there (mirroring the Matrix push gateway payload), while the call_*
// fields are camelCase (added directly by this app, not passed through from the
// gateway). Keep these aligned with that source rather than with the URL-search-param
// naming used by resolveIncomingCallFromSearchParams below, which is a separate format.
export const resolveIncomingCallFromNotificationData = (
  data: Record<string, unknown>,
  isDirect: boolean,
  now = Date.now()
): IncomingCall | undefined => {
  const roomId = typeof data.room_id === 'string' ? data.room_id : undefined;
  const eventId = typeof data.event_id === 'string' ? data.event_id : undefined;
  const callType =
    typeof data.callNotificationType === 'string' ? data.callNotificationType : undefined;

  if (!roomId || !eventId) return undefined;
  if (data.isCall !== true && !callType) return undefined;

  return fromCandidate(
    {
      roomId,
      notificationEventId: eventId,
      notificationTypeRaw: callType,
      intentKindRaw: typeof data.callIntentKind === 'string' ? data.callIntentKind : undefined,
      intentRaw: typeof data.callIntentRaw === 'string' ? data.callIntentRaw : undefined,
      refEventIdRaw: typeof data.callRefEventId === 'string' ? data.callRefEventId : undefined,
      senderIdRaw: typeof data.sender_id === 'string' ? data.sender_id : undefined,
      senderTsRaw: typeof data.callSenderTs === 'number' ? data.callSenderTs : undefined,
      expiresAtRaw: typeof data.callExpiresAt === 'number' ? data.callExpiresAt : undefined,
      isDirect,
    },
    now
  );
};

export const resolveIncomingCallFromSearchParams = (
  searchParams: URLSearchParams,
  roomId: string,
  notificationEventId: string | undefined,
  isDirect: boolean,
  now = Date.now()
): IncomingCall | undefined => {
  const isCallDeepLink =
    searchParams.get('call') === '1' ||
    searchParams.get('joinCall') === 'true' ||
    searchParams.get('joinCall') === '1';
  if (!isCallDeepLink) return undefined;
  if (!notificationEventId) {
    // notificationEventId is the event_id path segment of /to/:user_id/:room_id/:event_id?
    // — optional by route design (ordinary room links can omit it), but a genuine call
    // notification's own event should always have one (buildNotificationClickTargetUrl
    // includes it whenever the push payload's event_id is present, which the Matrix push
    // gateway spec treats as required). Log rather than silently dropping the call, since
    // there's no safe eventId to fall back to — sendRtcDecline needs the real one.
    debugLog.warn('call', 'Dropping incoming call: missing notificationEventId', { roomId });
    return undefined;
  }

  const senderTsParam = searchParams.get('callSenderTs');
  const expiresAtParam = searchParams.get('callExpiresAt');
  const senderTsRaw = senderTsParam ? Number(senderTsParam) : Number.NaN;
  const expiresAtRaw = expiresAtParam ? Number(expiresAtParam) : Number.NaN;

  return fromCandidate(
    {
      roomId,
      notificationEventId,
      notificationTypeRaw: searchParams.get('callType') ?? undefined,
      intentKindRaw: searchParams.get('callIntentKind') ?? undefined,
      intentRaw: searchParams.get('callIntentRaw') ?? undefined,
      refEventIdRaw: searchParams.get('callRefEventId') ?? undefined,
      senderIdRaw: searchParams.get('callSenderId') ?? undefined,
      senderTsRaw: Number.isFinite(senderTsRaw) ? senderTsRaw : undefined,
      expiresAtRaw: Number.isFinite(expiresAtRaw) ? expiresAtRaw : undefined,
      isDirect,
    },
    now
  );
};

export const dismissSystemCallNotifications = async (roomId?: string): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = roomId
      ? await registration.getNotifications({ tag: `call-${roomId}` })
      : await registration.getNotifications();
    notifications.forEach((notification) => {
      if (
        !roomId ||
        notification?.data?.room_id === roomId ||
        notification?.data?.roomId === roomId
      ) {
        notification.close();
      }
    });
  } catch {
    // Best-effort cleanup; ignore unsupported browsers and transient SW errors.
  }
};
