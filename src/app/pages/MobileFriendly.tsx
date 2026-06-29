import type { CSSProperties, ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '$hooks/useScreenSize';
import { isPhoneLayoutDevice } from '$utils/user-agent';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, SPACE_PATH } from './paths';

const HIDDEN_STYLE: CSSProperties = { display: 'none' };
const CONTENTS_STYLE: CSSProperties = { display: 'contents' };

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

  // Desktop: return children unwrapped so we never introduce display:contents there.
  if (!isMobile) return children;
  // Mobile: keep the nav mounted so returning from a room doesn't cause a remount.
  // CSS-hide rather than unmount to avoid a blank-flash during navigation.
  return <div style={atSectionRoot ? CONTENTS_STYLE : HIDDEN_STYLE}>{children}</div>;
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

  // Desktop: return children unwrapped so we never introduce display:contents there.
  if (!isMobile) return children;
  // Mobile: keep the room-list nav mounted while in a room so it's ready instantly
  // when the user swipes back. CSS-hide rather than returning null avoids a blank-flash.
  return <div style={exactPath ? CONTENTS_STYLE : HIDDEN_STYLE}>{children}</div>;
}
