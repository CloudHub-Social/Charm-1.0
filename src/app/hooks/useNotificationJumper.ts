import { useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { SyncState, ClientEvent } from '$types/matrix-sdk';
import * as Sentry from '@sentry/react';
import { activeSessionIdAtom, pendingNotificationAtom } from '$state/sessions';
import { mDirectAtom, mDirectReadyAtom } from '$state/mDirectList';
import { incomingCallAtom, mutedCallRoomIdAtom } from '$state/callEmbed';
import { resolveIncomingCallFromSearchParams } from '$features/call/callNotificationBridge';
import { isIncomingCallSuppressed } from '$features/call/callIncomingIngress';
import { settingsAtom } from '$state/settings';
import { useSetting } from '$state/hooks/settings';
import { roomToParentsAtom, roomToParentsReadyAtom } from '$state/room/roomToParents';
import { getStoredRoomNavRoot } from '$state/room/roomNavRoots';
import { useSyncState } from './useSyncState';
import { useMatrixClient } from './useMatrixClient';
import { getCanonicalAliasOrRoomId } from '$utils/matrix';
import {
  getDirectRoomPath,
  getHomeRoomPath,
  getSpaceRoomPath,
  getDirectPath,
  getHomePath,
  getSpacePath,
  withAdditionalSearchParams,
} from '$pages/pathUtils';
import { DIRECT_ROOM_PATH, HOME_ROOM_PATH, SPACE_ROOM_PATH } from '$pages/paths';
import { resolveSpaceNavigationRoot } from '$utils/room';
import { createLogger } from '$utils/debug';
import { clearLaunchContext } from '$app/../launch-context-persistence';
import {
  buildNotificationBreadcrumb,
  buildNotificationMetricAttributes,
} from '$utils/notificationTelemetry';

const NOTIFICATION_PARENT_GRAPH_WAIT_MAX_MS = 1_500;

export const hasTargetRoomParentMapping = (
  roomToParents: Map<string, Set<string>>,
  roomId: string
): boolean => (roomToParents.get(roomId)?.size ?? 0) > 0;

export const shouldWaitForTargetRoomParentGraph = (options: {
  isDirectRoom: boolean;
  hasTargetParentMapping: boolean;
  roomToParentsReady: boolean;
  storedRootSpaceId?: string;
  restoreAgeMs?: number;
}): boolean => {
  const {
    isDirectRoom,
    hasTargetParentMapping,
    roomToParentsReady,
    storedRootSpaceId,
    restoreAgeMs,
  } = options;

  return (
    !isDirectRoom &&
    !hasTargetParentMapping &&
    !roomToParentsReady &&
    storedRootSpaceId === undefined &&
    (restoreAgeMs === undefined || restoreAgeMs < NOTIFICATION_PARENT_GRAPH_WAIT_MAX_MS)
  );
};

function acknowledgeNotificationClick(clickId?: string) {
  if (!clickId || !('serviceWorker' in navigator)) return;

  const payload = {
    type: 'notificationClickHandled',
    clickId,
  };
  const posted = new Set<ServiceWorker>();
  const postToWorker = (worker: ServiceWorker | null | undefined) => {
    if (!worker || posted.has(worker)) return;
    posted.add(worker);
    worker.postMessage(payload);
  };

  postToWorker(navigator.serviceWorker.controller);
  navigator.serviceWorker.ready
    .then((registration) => {
      postToWorker(registration.active);
      postToWorker(registration.waiting);
      postToWorker(registration.installing);
    })
    .catch(() => undefined);

  void clearLaunchContext().catch(() => undefined);
}

export function NotificationJumper() {
  const [pending, setPending] = useAtom(pendingNotificationAtom);
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const mDirectReady = useAtomValue(mDirectReadyAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const roomToParentsReady = useAtomValue(roomToParentsReadyAtom);
  const mutedRoomId = useAtomValue(mutedCallRoomIdAtom);
  const [incomingVoiceRoomCallSoundEnabled] = useSetting(
    settingsAtom,
    'incomingVoiceRoomCallSoundEnabled'
  );
  const setIncomingCall = useSetAtom(incomingCallAtom);
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const location = useLocation();
  const log = createLogger('NotificationJumper');

  // Set true the moment we fire navigateRoom. Only reset when `pending` changes
  // to a new value (via the effect below). Do NOT reset inside performJump itself:
  // setPending(null) is async — resetting here creates a window where atom/render
  // churn re-calls performJump (from the ClientEvent.Room listener or effect
  // re-runs) before React has committed the null, causing repeated navigation.
  const jumpingRef = useRef(false);
  // Guards deferred call resolution the same way jumpingRef guards the room jump:
  // performJump can run multiple times while waiting on room/sync state, and
  // resolving+setting the incoming call more than once would re-trigger the ringtone.
  const handledCallRef = useRef(false);
  const parentGraphWaitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const performJump = useCallback(() => {
    if (!pending || jumpingRef.current) return;
    if (pending.targetSessionId && pending.targetSessionId !== activeSessionId) {
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_wait_target_session', {
          click_id: pending.swClickId,
          target_session_id: pending.targetSessionId,
          active_session_id: activeSessionId,
          source: pending.source,
        })
      );
      log.log('waiting for target session atom...', {
        targetSessionId: pending.targetSessionId,
        activeSessionId,
      });
      return;
    }

    // The mx client context may lag one render behind the atom — wait until it catches up.
    if (pending.targetSessionId && mx.getUserId() !== pending.targetSessionId) {
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_wait_client_session', {
          click_id: pending.swClickId,
          target_session_id: pending.targetSessionId,
          current_user_id: mx.getUserId(),
          source: pending.source,
        })
      );
      log.log('waiting for mx client to switch to target session...', {
        targetSessionId: pending.targetSessionId,
        currentUserId: mx.getUserId(),
      });
      return;
    }

    // Both session gates above passed, so mDirects/mutedRoomId/the notification-sound
    // setting now reflect the target session — safe to resolve the deferred incoming
    // call that ToRoomEvent couldn't resolve correctly before the account switch or
    // (on a cold launch) before mDirectAtom was bound. Wait for mDirectReady too rather
    // than marking handled and resolving against a still-empty Set — and return here
    // (rather than falling through to the room-jump below) so a same-session call click
    // that beats useBindMDirectAtom's readiness flip doesn't navigate + clear `pending`
    // before the call is ever resolved, which would silently drop the answer/decline UI.
    if (pending.callSearchParams && !handledCallRef.current) {
      if (!mDirectReady) return;
      handledCallRef.current = true;
      const callParams = new URLSearchParams(pending.callSearchParams);
      const incomingCall = resolveIncomingCallFromSearchParams(
        callParams,
        pending.roomId,
        pending.eventId,
        mDirects.has(pending.roomId)
      );
      if (
        incomingCall &&
        !isIncomingCallSuppressed(incomingCall, mutedRoomId, incomingVoiceRoomCallSoundEnabled)
      ) {
        setIncomingCall(incomingCall);
      }
    }

    const isSyncing = mx.getSyncState() === SyncState.Syncing;
    const room = mx.getRoom(pending.roomId);
    const isJoined = room?.getMyMembership() === 'join';
    const restoreAgeMs =
      typeof pending.requestedAt === 'number' ? Date.now() - pending.requestedAt : undefined;
    const currentUserId = mx.getUserId() ?? undefined;
    const storedRootSpaceId =
      currentUserId !== undefined ? getStoredRoomNavRoot(currentUserId, pending.roomId) : undefined;
    const hasTargetParentMapping = hasTargetRoomParentMapping(roomToParents, pending.roomId);
    const shouldWaitForParentGraph = shouldWaitForTargetRoomParentGraph({
      isDirectRoom: mDirects.has(pending.roomId),
      hasTargetParentMapping,
      roomToParentsReady,
      storedRootSpaceId,
      restoreAgeMs,
    });

    if (shouldWaitForParentGraph) {
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_wait_parent_graph', {
          click_id: pending.swClickId,
          room_id: pending.roomId,
          source: pending.source,
          restore_age_ms: restoreAgeMs,
          room_to_parents_ready: roomToParentsReady,
          room_to_parents_size: roomToParents.size,
          has_target_parent_mapping: hasTargetParentMapping,
          wait_budget_ms: NOTIFICATION_PARENT_GRAPH_WAIT_MAX_MS,
        })
      );
      return;
    }

    if (isSyncing && isJoined) {
      log.log('jumping to:', pending.roomId, pending.eventId);
      jumpingRef.current = true;
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_jump_started', {
          click_id: pending.swClickId,
          room_id: pending.roomId,
          event_id: pending.eventId,
          has_event_id: !!pending.eventId,
          jump_mode: pending.jumpMode,
          source: pending.source,
        })
      );
      Sentry.metrics.count('sable.notification.jump_started', 1, {
        attributes: buildNotificationMetricAttributes({
          click_id: pending.swClickId,
          has_event_id: !!pending.eventId,
          jump_mode: pending.jumpMode,
          source: pending.source ?? 'unknown',
        }),
      });
      // Navigate directly to home or direct path — bypasses space routing which
      // on mobile shows the space-nav panel first instead of the room timeline.
      // First replace the current history entry with the section overview so that
      // pressing back (including native iOS swipe-back) returns to the section list
      // rather than the room the user was in before the notification.
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, pending.roomId);
      const { rootSpaceId: chosenRootSpaceId, source: rootSource } = resolveSpaceNavigationRoot(
        mx,
        roomToParents,
        pending.roomId,
        { storedRootSpaceId }
      );

      // Compute target paths up-front so both branches can share them.
      let targetSectionPath: string;
      let targetRoomPath: string;
      if (mDirects.has(pending.roomId)) {
        targetSectionPath = getDirectPath();
        targetRoomPath = getDirectRoomPath(roomIdOrAlias, pending.eventId);
      } else {
        const parentSpace = chosenRootSpaceId;
        if (parentSpace) {
          const spaceIdOrAlias = getCanonicalAliasOrRoomId(mx, parentSpace ?? pending.roomId);
          targetSectionPath = getSpacePath(spaceIdOrAlias);
          targetRoomPath = getSpaceRoomPath(spaceIdOrAlias, roomIdOrAlias, pending.eventId);
        } else {
          targetSectionPath = getHomePath();
          targetRoomPath = getHomeRoomPath(roomIdOrAlias, pending.eventId);
        }
      }
      targetRoomPath = withAdditionalSearchParams(targetRoomPath, {
        joinCall: pending.joinCall ? 'true' : undefined,
        jumpMode: pending.jumpMode,
      });

      // eventId is an optional param in the same route segment (:roomIdOrAlias/:eventId?/),
      // so navigating from /direct/!room/ to /direct/!room/$event/ is a re-render of the
      // existing Room component — not an unmount. loadEventTimeline() picks up the new
      // eventId and fetches the event from the server if it isn't in the local cache yet.
      // Skipping the section→room two-step avoids an unnecessary unmount that would:
      //   a) reset isAtBottomRef so live events don't auto-scroll, and
      //   b) lose the current scroll position for the "back" gesture.
      const roomMatch =
        matchPath(DIRECT_ROOM_PATH, location.pathname) ??
        matchPath(HOME_ROOM_PATH, location.pathname) ??
        matchPath(SPACE_ROOM_PATH, location.pathname);
      const currentRoomIdOrAlias = roomMatch?.params.roomIdOrAlias
        ? decodeURIComponent(roomMatch.params.roomIdOrAlias)
        : undefined;
      const alreadyInRoom =
        currentRoomIdOrAlias !== undefined &&
        (currentRoomIdOrAlias === roomIdOrAlias || currentRoomIdOrAlias === pending.roomId);

      if (alreadyInRoom) {
        navigate(targetRoomPath, { replace: true });
      } else {
        // First replace the current history entry with the section overview so
        // that pressing back returns to the section list rather than the previous room.
        navigate(targetSectionPath, { replace: true });
        navigate(targetRoomPath);
      }
      acknowledgeNotificationClick(pending.swClickId);
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_click_acknowledged', {
          click_id: pending.swClickId,
          room_id: pending.roomId,
          event_id: pending.eventId,
          source: pending.source,
          jump_mode: pending.jumpMode,
          chosen_root_space_id: chosenRootSpaceId,
          root_source: rootSource,
          room_to_parents_ready: roomToParentsReady,
          has_target_parent_mapping: hasTargetParentMapping,
        })
      );
      const restoreLatencyMs =
        typeof pending.requestedAt === 'number' ? Date.now() - pending.requestedAt : undefined;
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_jump_completed', {
          click_id: pending.swClickId,
          room_id: pending.roomId,
          event_id: pending.eventId,
          has_event_id: !!pending.eventId,
          source: pending.source,
          jump_mode: pending.jumpMode,
          restore_latency_ms: restoreLatencyMs,
          already_in_room: alreadyInRoom,
          chosen_root_space_id: chosenRootSpaceId,
          root_source: rootSource,
          room_to_parents_ready: roomToParentsReady,
          has_target_parent_mapping: hasTargetParentMapping,
        })
      );
      Sentry.metrics.count('sable.notification.jump_completed', 1, {
        attributes: buildNotificationMetricAttributes({
          click_id: pending.swClickId,
          has_event_id: !!pending.eventId,
          source: pending.source ?? 'unknown',
          jump_mode: pending.jumpMode,
          already_in_room: alreadyInRoom,
          chosen_root_space_id: chosenRootSpaceId,
          root_source: rootSource,
          room_to_parents_ready: roomToParentsReady,
          has_target_parent_mapping: hasTargetParentMapping,
        }),
      });
      if (restoreLatencyMs !== undefined) {
        Sentry.metrics.distribution('sable.notification.restore_ms', restoreLatencyMs, {
          attributes: buildNotificationMetricAttributes({
            click_id: pending.swClickId,
            source: pending.source ?? 'unknown',
            jump_mode: pending.jumpMode,
            already_in_room: alreadyInRoom,
            chosen_root_space_id: chosenRootSpaceId,
            root_source: rootSource,
            room_to_parents_ready: roomToParentsReady,
            has_target_parent_mapping: hasTargetParentMapping,
          }),
        });
      }
      setPending(null);
      // jumpingRef stays true until pending changes — see effect below.
    } else {
      Sentry.addBreadcrumb(
        buildNotificationBreadcrumb('restore', 'restore_wait_room_ready', {
          click_id: pending.swClickId,
          room_id: pending.roomId,
          is_syncing: isSyncing,
          has_room: !!room,
          membership: room?.getMyMembership(),
          source: pending.source,
          jump_mode: pending.jumpMode,
          room_to_parents_ready: roomToParentsReady,
          has_target_parent_mapping: hasTargetParentMapping,
          stored_root_space_id: storedRootSpaceId,
        })
      );
      log.log('still waiting for room data...', {
        isSyncing,
        hasRoom: !!room,
        membership: room?.getMyMembership(),
      });
    }
  }, [
    pending,
    activeSessionId,
    mx,
    mDirects,
    mDirectReady,
    roomToParents,
    roomToParentsReady,
    mutedRoomId,
    incomingVoiceRoomCallSoundEnabled,
    setIncomingCall,
    navigate,
    location,
    setPending,
    log,
  ]);

  // Reset the guards only when pending is replaced (new notification or cleared).
  useEffect(() => {
    jumpingRef.current = false;
    handledCallRef.current = false;
  }, [pending]);

  // Keep a stable ref to the latest performJump so that the listeners below
  // always invoke the current version without adding performJump to their dep
  // arrays. Adding performJump as a dep causes the effect to re-run (and call
  // performJump again) on every atom change during an account switch — that is
  // the second source of repeated navigation.
  const performJumpRef = useRef(performJump);
  performJumpRef.current = performJump;

  useSyncState(
    mx,
    // Stable callback — reads from ref, so useSyncState never re-registers.
    useCallback((current) => {
      if (current === SyncState.Syncing) performJumpRef.current();
    }, [])
  );

  useEffect(() => {
    if (!pending) return undefined;

    const onRoom = () => performJumpRef.current();
    mx.on(ClientEvent.Room, onRoom);
    performJumpRef.current();

    return () => {
      mx.removeListener(ClientEvent.Room, onRoom);
    };
  }, [pending, mx]); // performJump intentionally omitted — use ref above

  useEffect(() => {
    if (!pending || jumpingRef.current) return undefined;

    performJumpRef.current();

    const currentUserId = mx.getUserId() ?? undefined;
    const storedRootSpaceId =
      currentUserId !== undefined ? getStoredRoomNavRoot(currentUserId, pending.roomId) : undefined;
    const restoreAgeMs =
      typeof pending.requestedAt === 'number' ? Date.now() - pending.requestedAt : undefined;
    const shouldWaitForParentGraph = shouldWaitForTargetRoomParentGraph({
      isDirectRoom: mDirects.has(pending.roomId),
      hasTargetParentMapping: hasTargetRoomParentMapping(roomToParents, pending.roomId),
      roomToParentsReady,
      storedRootSpaceId,
      restoreAgeMs,
    });

    if (!shouldWaitForParentGraph) return undefined;

    const remainingWaitMs =
      typeof restoreAgeMs === 'number'
        ? Math.max(NOTIFICATION_PARENT_GRAPH_WAIT_MAX_MS - restoreAgeMs, 0)
        : NOTIFICATION_PARENT_GRAPH_WAIT_MAX_MS;

    parentGraphWaitTimerRef.current = setTimeout(() => {
      parentGraphWaitTimerRef.current = undefined;
      performJumpRef.current();
    }, remainingWaitMs);

    return () => {
      if (parentGraphWaitTimerRef.current !== undefined) {
        clearTimeout(parentGraphWaitTimerRef.current);
        parentGraphWaitTimerRef.current = undefined;
      }
    };
    // mDirectReady is included so that a jump deferred above (waiting on it to resolve
    // a pending incoming call) actually resumes once useBindMDirectAtom flips it true —
    // nothing else in this effect's other deps changes when that happens.
  }, [pending, roomToParents, roomToParentsReady, mDirects, mDirectReady, mx]);

  return null;
}
