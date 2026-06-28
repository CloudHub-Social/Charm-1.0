import { stripRoomEventSegment } from '$pages/pathUtils';
import type { TimelineJumpMode } from '$hooks/timeline/useTimelineSync';

export const shouldCleanNotificationJumpOnBack = ({
  eventId,
  jumpMode,
  pathname,
}: {
  eventId?: string;
  jumpMode?: TimelineJumpMode;
  pathname: string;
}): boolean =>
  Boolean(
    eventId &&
    jumpMode === 'notification_live' &&
    stripRoomEventSegment(pathname, eventId) !== pathname
  );

// Notification jump routes are transient state. When the user leaves them via
// back navigation, normalize the current history entry first so revisiting it
// does not re-arm the jump route.
export const buildEventTargetCleanupTarget = (
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
