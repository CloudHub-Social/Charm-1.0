import type { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '$hooks/useScreenSize';
import { isPhoneLayoutDevice } from '$utils/user-agent';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, SPACE_PATH } from './paths';

// On mobile the room-list nav is unmounted while a room (or any non-root path)
// is open. We deliberately unmount rather than CSS-hide (`display: none`): the
// lists (Home/Direct/Space) render virtualized rows via `useVirtualizer`, whose
// scroll element measures 0×0 while `display: none`, collapsing the rendered
// window to nothing. CSS-revealing it later left the list blank until the
// virtualizer's ResizeObserver re-measured a frame later, so the list visibly
// "cleared and refreshed" for ~half a second every time it was opened on mobile
// (issue #482). A fresh mount measures the real height on first paint instead,
// so the list is correct immediately.

type MobileFriendlyClientNavProps = {
  children: ReactNode;
};
export function MobileFriendlyClientNav({ children }: MobileFriendlyClientNavProps) {
  const screenSize = useScreenSizeContext();
  const homeMatch = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const directMatch = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const spaceMatch = useMatch({ path: SPACE_PATH, caseSensitive: true, end: true });
  const exploreMatch = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: true });
  const inboxMatch = useMatch({ path: INBOX_PATH, caseSensitive: true, end: true });

  const isMobile = screenSize === ScreenSize.Mobile || isPhoneLayoutDevice();
  const atSectionRoot = !!(homeMatch || directMatch || spaceMatch || exploreMatch || inboxMatch);

  if (isMobile && !atSectionRoot) return null;
  return children;
}

type MobileFriendlyPageNavProps = {
  path: string;
  children: ReactNode;
};
export function MobileFriendlyPageNav({ path, children }: MobileFriendlyPageNavProps) {
  const screenSize = useScreenSizeContext();
  const exactPath = useMatch({
    path,
    caseSensitive: true,
    end: true,
  });

  const isMobile = screenSize === ScreenSize.Mobile || isPhoneLayoutDevice();

  if (isMobile && !exactPath) return null;
  return children;
}
