import type { HashRouterConfig } from '$hooks/useClientConfig';
import { consumeLaunchContext } from '../../launch-context-persistence';
import { getAppPathFromHref, getOriginBaseUrl } from './pathUtils';

// A notification click that's this stale is more likely a suspended/backgrounded
// tab finally resuming than a genuine "user just tapped this" launch -- falling
// back to the default landing screen is the better guess at that point.
const NOTIFICATION_LAUNCH_MAX_AGE_MS = 15_000;

export type RecoveredNotificationLaunch = {
  path: string;
  launchAgeMs: number;
  hasUserId: boolean;
  hasRoomId: boolean;
  hasEventId: boolean;
};

/**
 * Consumes the persisted notification-click launch context (if any) and
 * resolves the in-app path it should recover to.
 *
 * This must be awaited by the router's index-route loader rather than
 * triggering a fire-and-forget `window.location.replace()` elsewhere: a
 * data-router loader is awaited before anything renders, so awaiting this
 * here is what makes recovery deterministic instead of racing against the
 * loader's own default-landing redirect (previously observed to lose that
 * race consistently on WebKit, where Cache Storage/microtask timing runs
 * differently than on Chromium).
 */
export async function recoverNotificationLaunchPath(
  hashRouterConfig?: HashRouterConfig
): Promise<RecoveredNotificationLaunch | undefined> {
  const launchContext = await consumeLaunchContext();
  if (!launchContext?.targetUrl) return undefined;

  const launchAgeMs = Date.now() - launchContext.clickedAt;
  if (launchAgeMs > NOTIFICATION_LAUNCH_MAX_AGE_MS) return undefined;

  try {
    const target = new URL(launchContext.targetUrl, window.location.origin);
    if (target.origin !== window.location.origin) return undefined;

    return {
      path: getAppPathFromHref(getOriginBaseUrl(hashRouterConfig), target.href),
      launchAgeMs,
      hasUserId: !!launchContext.userId,
      hasRoomId: !!launchContext.roomId,
      hasEventId: !!launchContext.eventId,
    };
  } catch {
    return undefined;
  }
}
