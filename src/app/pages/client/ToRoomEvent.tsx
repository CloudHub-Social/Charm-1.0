import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import * as Sentry from '@sentry/react';
import {
  activeSessionIdAtom,
  createPendingNotification,
  pendingNotificationAtom,
} from '$state/sessions';
import {
  buildNotificationBreadcrumb,
  buildNotificationMetricAttributes,
} from '$utils/notificationTelemetry';
import { mDirectAtom, mDirectReadyAtom } from '$state/mDirectList';
import { incomingCallAtom, mutedCallRoomIdAtom } from '$state/callEmbed';
import {
  isCallDeepLinkSearchParams,
  resolveIncomingCallFromSearchParams,
} from '$features/call/callNotificationBridge';
import { isIncomingCallSuppressed } from '$features/call/callIncomingIngress';
import { settingsAtom } from '$state/settings';
import { useSetting } from '$state/hooks/settings';
import { getRootPath } from '$pages/pathUtils';

// ToRoomEvent handles /to/:user_id/:room_id/:event_id? — the canonical deep-link
// URL used by the service worker's notificationclick handler.
//
// The :user_id segment lets the SW embed the target Matrix user ID directly in
// the URL (e.g. %40alice%3Aserver.tld) so the correct account is always
// activated before navigation, even on a cold launch where the app restarts
// from scratch after the PWA was killed by the OS.
//
// This component does NOT navigate itself — it writes to pendingNotificationAtom
// so NotificationJumper can navigate once the Matrix client has finished its
// initial sync. The atom survives the ClientRoot reload that happens when
// setActiveSessionId() triggers an account switch.
export function ToRoomEvent() {
  const { user_id: userId, room_id: roomId, event_id: eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const mDirectReady = useAtomValue(mDirectReadyAtom);
  const mutedRoomId = useAtomValue(mutedCallRoomIdAtom);
  const [incomingVoiceRoomCallSoundEnabled] = useSetting(
    settingsAtom,
    'incomingVoiceRoomCallSoundEnabled'
  );
  const setActiveSessionId = useSetAtom(activeSessionIdAtom);
  const setPending = useSetAtom(pendingNotificationAtom);
  // Extract primitive values from searchParams so the navigation effect below
  // depends on stable values, not the URLSearchParams object reference (which
  // React Router v6 recreates on every render).
  const joinCall = searchParams.get('joinCall') === 'true';
  const swClickId = searchParams.get('swClickId') ?? undefined;
  const jumpMode =
    searchParams.get('jumpMode') === 'notification_live' ? 'notification_live' : 'history_context';
  const rawSearchParams = searchParams.toString();
  const setIncomingCall = useSetAtom(incomingCallAtom);

  useEffect(() => {
    if (!roomId) return;
    Sentry.addBreadcrumb(
      buildNotificationBreadcrumb('restore', 'restore_route_entered', {
        click_id: swClickId,
        source: 'to_room_event',
        has_user_id: !!userId,
        has_room_id: !!roomId,
        has_event_id: !!eventId,
        jump_mode: jumpMode,
      })
    );
    Sentry.metrics.count('sable.notification.to_route', 1, {
      attributes: buildNotificationMetricAttributes({
        click_id: swClickId,
        source: 'to_room_event',
        has_user_id: !!userId,
        has_room_id: !!roomId,
        has_event_id: !!eventId,
        jump_mode: jumpMode,
      }),
    });
    // Switch to the target account first so the notification jumper navigates
    // under the correct session.
    const needsAccountSwitch = !!userId && userId !== activeSessionId;
    // On a cold launch, ClientBindAtoms (which populates mDirectAtom) is the parent of
    // both NotificationJumper and the routed ToRoomEvent, so its effect hasn't run yet
    // when this one does — mDirects.has(roomId) below would read the initial empty Set
    // even for a genuine DM, misclassifying the call and never getting a chance to
    // self-correct (this component navigates itself away immediately after).
    const needsDeferral = needsAccountSwitch || !mDirectReady;
    if (userId) setActiveSessionId(userId);
    setPending(
      createPendingNotification({
        roomId,
        eventId,
        jumpMode,
        joinCall,
        targetSessionId: userId,
        swClickId,
        source: 'to_room_event',
        // Resolving now would read mDirects/mutedRoomId/settings before they're
        // trustworthy (either the pre-switch session's, or not yet bound at all) —
        // defer to NotificationJumper, which already waits for both the target
        // session's client to become active and (see mDirectReadyAtom) for
        // session-scoped atoms to actually be populated. Only stash this for URLs that
        // actually carry call metadata — NotificationJumper treats any truthy
        // callSearchParams as "this click needs deferred call resolution", so setting it
        // for an ordinary (non-call) notification click would misroute it into that path.
        callSearchParams:
          needsDeferral && isCallDeepLinkSearchParams(searchParams) ? rawSearchParams : undefined,
      })
    );

    if (!needsDeferral) {
      const incomingCall = resolveIncomingCallFromSearchParams(
        searchParams,
        roomId,
        eventId,
        mDirects.has(roomId)
      );
      if (
        incomingCall &&
        !isIncomingCallSuppressed(incomingCall, mutedRoomId, incomingVoiceRoomCallSoundEnabled)
      ) {
        setIncomingCall(incomingCall);
      }
    }

    // Replace /to/… in history so the back button doesn't return to this route. Uses the
    // router's navigate (not window.history.replaceState) so the basename/hash-router
    // config configured in Router.tsx is respected instead of always landing on origin root.
    navigate(getRootPath(), { replace: true });
    // searchParams is read above via its stable rawSearchParams string form (see comment
    // near its declaration); depending on the URLSearchParams object itself would re-fire
    // this effect on every render. activeSessionId, mDirectReady, and mDirects are
    // intentionally read once (not listed as deps): they're only used to snapshot whether
    // this click needs to defer resolution, and listing them would re-run this effect
    // (redundantly re-navigating and re-stashing pending state — with needsDeferral now
    // false, overwriting the previously-stashed callSearchParams with undefined) once they
    // update — the component navigates away immediately below regardless, so a second run
    // couldn't self-correct anyway (see needsDeferral above for why that matters here).
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventId,
    jumpMode,
    joinCall,
    swClickId,
    mutedRoomId,
    navigate,
    roomId,
    rawSearchParams,
    setActiveSessionId,
    setIncomingCall,
    setPending,
    userId,
    incomingVoiceRoomCallSoundEnabled,
  ]);

  return null;
}
