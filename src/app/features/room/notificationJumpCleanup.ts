import { stripRoomEventSegment } from '$pages/pathUtils';
import type { TimelineJumpMode } from '$hooks/timeline/useTimelineSync';

type NotificationJumpCleanupOptions = {
  eventId?: string;
  jumpMode?: TimelineJumpMode;
  atBottom: boolean;
  liveTimelineLinked: boolean;
};

export const shouldClearNotificationJumpRoute = ({
  eventId,
  jumpMode,
  atBottom,
  liveTimelineLinked,
}: NotificationJumpCleanupOptions): boolean =>
  Boolean(eventId && jumpMode === 'notification_live' && atBottom && liveTimelineLinked);

// URL-only cleanup: remove stale jump params from the history entry when the
// event was too far from live to trigger the full cleanup (which requires the
// user to scroll to the bottom). Leaving ?jumpMode&eventId in the URL causes
// the notification jump to re-fire if the user swipes back to that history
// entry via the native gesture.
export const shouldClearNotificationJumpRouteURLOnly = ({
  eventId,
  jumpMode,
  liveTimelineLinked,
}: Pick<NotificationJumpCleanupOptions, 'eventId' | 'jumpMode' | 'liveTimelineLinked'>): boolean =>
  Boolean(eventId && jumpMode && !liveTimelineLinked);

export const getNotificationJumpCleanupEventId = (
  options: NotificationJumpCleanupOptions
): string | undefined => (shouldClearNotificationJumpRoute(options) ? options.eventId : undefined);

export const buildNotificationJumpCleanupTarget = (
  pathname: string,
  search: string,
  eventId: string
): string => {
  const nextSearchParams = new URLSearchParams(search);
  nextSearchParams.delete('jumpMode');
  nextSearchParams.delete('joinCall');
  const nextSearch = nextSearchParams.toString();
  const nextPathname = stripRoomEventSegment(pathname, eventId);

  return nextSearch ? `${nextPathname}?${nextSearch}` : nextPathname;
};
