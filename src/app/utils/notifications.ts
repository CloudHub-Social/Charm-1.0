import * as Sentry from '@sentry/react';
import { isTauri } from '@tauri-apps/api/core';
import type { MatrixClient, MatrixEvent } from '$types/matrix-sdk';
import { EventType, NotificationCountType, ReceiptType } from '$types/matrix-sdk';
import { createDebugLogger } from './debugLogger';

const debugLog = createDebugLogger('notifications');

const getLiveEventIndex = (events: MatrixEvent[], eventId: string | undefined): number =>
  eventId ? events.findIndex((event) => event.getId() === eventId) : -1;

export async function markAsRead(mx: MatrixClient, roomId: string, privateReceipt: boolean) {
  const room = mx.getRoom(roomId);
  if (!room) return;

  const timeline = room.getLiveTimeline().getEvents();
  const readEventId = room.getEventReadUpTo(mx.getUserId()!);
  const fullyReadEventId = room
    .getAccountData(EventType.FullyRead)
    ?.getContent<{ event_id?: string }>()?.event_id;

  const getLatestValidEvent = (): MatrixEvent | null => {
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      const latestEvent = timeline[i];
      if (!latestEvent) continue;
      if (!latestEvent.isSending()) return latestEvent;
    }
    return null;
  };
  if (timeline.length === 0) return;
  const latestEvent = getLatestValidEvent();
  if (latestEvent === null) return;

  const latestEventId = latestEvent.getId();
  if (!latestEventId) return;

  if (latestEventId === readEventId) {
    const roomUnreadTotal = room.getRoomUnreadNotificationCount(NotificationCountType.Total);
    const hasUnreadCounts =
      roomUnreadTotal > 0 || room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0;
    const fullyReadIndex = getLiveEventIndex(timeline, fullyReadEventId);
    const readEventIndex = getLiveEventIndex(timeline, readEventId);
    const hasStaleFullyReadMarker = fullyReadIndex >= 0 && fullyReadIndex < readEventIndex;
    if (!hasUnreadCounts && !hasStaleFullyReadMarker) return;
  }

  try {
    // Update both read receipt and fully-read marker so unread state clears reliably
    // across clients and bridge-heavy rooms where hidden events may exist.
    if (privateReceipt) {
      await mx.setRoomReadMarkers(roomId, latestEventId, undefined, latestEvent);
    } else {
      await mx.setRoomReadMarkers(roomId, latestEventId, latestEvent);
    }
  } catch (err) {
    debugLog.warn('notification', 'Failed to set room read marker; falling back to receipt', {
      error: err instanceof Error ? err.message : String(err),
      privateReceipt,
    });
    Sentry.captureException(err, {
      level: 'warning',
      tags: {
        component: 'markAsRead',
        operation: 'setRoomReadMarkers',
        private_receipt: String(privateReceipt),
      },
      extra: {
        eventId: latestEventId,
      },
    });
  }

  // Keep legacy receipt path as a safety fallback for homeservers with partial support.
  // Send it UNTHREADED: "mark room as read" is a whole-room action, and an unthreaded
  // receipt is the only kind that overwrites a stale unthreaded receipt left pinned at a
  // vanished event. A threaded (thread_id: "main") receipt lands in a different bucket and
  // silently no-ops against such a marker (threaded receipts for untracked threads bypass
  // addReceiptToStructure), leaving the server's notification_count and getEventReadUpTo stuck.
  await mx.sendReadReceipt(
    latestEvent,
    privateReceipt ? ReceiptType.ReadPrivate : ReceiptType.Read,
    true
  );

  // Optimistically clear the local SDK unread counters. `setRoomReadMarkers`/
  // `sendReadReceipt` already local-echo the read receipt, but the SDK never
  // advances `m.fully_read` or the notification counters locally — those only
  // move once sync echoes the change back. Under sliding sync that echo can lag
  // or be clobbered when the room re-enters the window, leaving the badge stuck
  // at a stale count even though the server is read. Zeroing the counters here
  // (while the just-applied receipt echo makes `roomHaveUnread` false) lets the
  // RoomEvent.UnreadNotifications listener drop the badge immediately, and a
  // genuine later message will re-raise the counter through normal sync.
  room.setUnreadNotificationCount(NotificationCountType.Total, 0);
  room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);

  // On Android (Tauri), dismiss the room's OS notification immediately so
  // it stays in sync with the read state instead of lingering until the
  // next push payload with unread: 0 arrives.
  if (isTauri()) {
    try {
      const { clearRoomNotification } =
        await import('$features/settings/notifications/UnifiedPushRuntime');
      await clearRoomNotification(roomId);
    } catch {
      // Notification plugin not available (desktop, web) — ignore.
    }
  }
}
