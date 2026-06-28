import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import {
  getDirectPath,
  getExplorePath,
  getHomePath,
  getInboxPath,
  getSpacePath,
} from '$pages/pathUtils';
import {
  DIRECT_PATH,
  EXPLORE_PATH,
  HOME_PATH,
  INBOX_PATH,
  SPACE_PATH,
  HOME_ROOM_PATH,
  DIRECT_ROOM_PATH,
  SPACE_ROOM_PATH,
} from '$pages/paths';
import { lastVisitedRoomIdAtom } from '$state/room/lastRoom';
import {
  buildEventTargetCleanupTarget,
  shouldCleanNotificationJumpOnBack,
} from '$features/room/notificationJumpCleanup';

type BackRouteHandlerProps = {
  children: (onBack: () => void) => ReactNode;
};
export function BackRouteHandler({ children }: BackRouteHandlerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const setLastRoomId = useSetAtom(lastVisitedRoomIdAtom);

  const goBack = useCallback(() => {
    const roomPaths = [HOME_ROOM_PATH, DIRECT_ROOM_PATH, SPACE_ROOM_PATH];

    const roomMatch = roomPaths
      .map((path) => matchPath({ path, end: false }, location.pathname))
      .find((match) => match !== null);

    const currentRoomIdOrAlias = roomMatch?.params.roomIdOrAlias;
    if (currentRoomIdOrAlias) {
      setLastRoomId(decodeURIComponent(currentRoomIdOrAlias));
    }

    // Use a native history pop when there is prior history. This keeps the
    // in-app back button and the native iOS swipe-back gesture in sync: both
    // traverse the same stack, so the room entry is never left "behind" the
    // section and there are no phantom pushes for swipe-back to stumble into.
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
    if (historyIdx !== undefined && historyIdx > 0) {
      const eventId = roomMatch?.params.eventId;
      const jumpMode = new URLSearchParams(location.search).get('jumpMode') ?? undefined;

      if (
        shouldCleanNotificationJumpOnBack({
          eventId,
          jumpMode: jumpMode === 'notification_live' ? jumpMode : undefined,
          pathname: location.pathname,
        })
      ) {
        navigate(buildEventTargetCleanupTarget(location.pathname, location.search, eventId!), {
          replace: true,
        });
      }

      navigate(-1);
      return;
    }

    // No back history — navigate to the section root and replace the current
    // entry so the room doesn't linger as a forward entry.
    if (
      matchPath(
        {
          path: HOME_PATH,
          caseSensitive: true,
          end: false,
        },
        location.pathname
      )
    ) {
      navigate(getHomePath(), { replace: true });
      return;
    }
    if (
      matchPath(
        {
          path: DIRECT_PATH,
          caseSensitive: true,
          end: false,
        },
        location.pathname
      )
    ) {
      navigate(getDirectPath(), { replace: true });
      return;
    }
    const spaceMatch = matchPath(
      {
        path: SPACE_PATH,
        caseSensitive: true,
        end: false,
      },
      location.pathname
    );
    const encodedSpaceIdOrAlias = spaceMatch?.params.spaceIdOrAlias;
    const decodedSpaceIdOrAlias =
      encodedSpaceIdOrAlias && decodeURIComponent(encodedSpaceIdOrAlias);

    if (decodedSpaceIdOrAlias) {
      navigate(getSpacePath(decodedSpaceIdOrAlias), { replace: true });
      return;
    }
    if (
      matchPath(
        {
          path: EXPLORE_PATH,
          caseSensitive: true,
          end: false,
        },
        location.pathname
      )
    ) {
      navigate(getExplorePath(), { replace: true });
      return;
    }
    if (
      matchPath(
        {
          path: INBOX_PATH,
          caseSensitive: true,
          end: false,
        },
        location.pathname
      )
    ) {
      navigate(getInboxPath(), { replace: true });
    }
  }, [navigate, location, setLastRoomId]);

  return children(goBack);
}
