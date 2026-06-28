import { matchPath } from 'react-router-dom';
import {
  getDirectPath,
  getExplorePath,
  getHomePath,
  getInboxPath,
  getSpacePath,
  withAdditionalSearchParams,
} from '$pages/pathUtils';
import {
  DIRECT_PATH,
  EXPLORE_PATH,
  HOME_PATH,
  INBOX_PATH,
  SPACE_PATH,
  TO_ROOM_EVENT_PATH,
} from '$pages/paths';

export const getClientRootGuardTarget = (pathname: string, search: string): string | undefined => {
  if (matchPath({ path: TO_ROOM_EVENT_PATH, end: true }, pathname)) {
    return undefined;
  }

  if (matchPath({ path: HOME_PATH, end: true }, pathname)) {
    return undefined;
  }
  if (matchPath({ path: HOME_PATH, end: false }, pathname)) {
    const params = new URLSearchParams(search);
    const homeView = params.get('homeView') ?? undefined;
    return withAdditionalSearchParams(getHomePath(), { homeView });
  }

  if (matchPath({ path: DIRECT_PATH, end: true }, pathname)) {
    return undefined;
  }
  if (matchPath({ path: DIRECT_PATH, end: false }, pathname)) {
    return getDirectPath();
  }

  if (matchPath({ path: INBOX_PATH, end: true }, pathname)) {
    return undefined;
  }
  if (matchPath({ path: INBOX_PATH, end: false }, pathname)) {
    return getInboxPath();
  }

  if (matchPath({ path: EXPLORE_PATH, end: true }, pathname)) {
    return undefined;
  }
  if (matchPath({ path: EXPLORE_PATH, end: false }, pathname)) {
    return getExplorePath();
  }

  const spaceRootMatch = matchPath({ path: SPACE_PATH, end: true }, pathname);
  if (spaceRootMatch?.params.spaceIdOrAlias) {
    return undefined;
  }

  const spaceChildMatch = matchPath({ path: SPACE_PATH, end: false }, pathname);
  const encodedSpaceIdOrAlias = spaceChildMatch?.params.spaceIdOrAlias;
  if (encodedSpaceIdOrAlias) {
    return getSpacePath(decodeURIComponent(encodedSpaceIdOrAlias));
  }

  return undefined;
};
