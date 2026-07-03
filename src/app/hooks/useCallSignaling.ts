import { useCallback, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import type { RoomEventHandlerMap, MatrixEvent, Room } from '$types/matrix-sdk';
import { MatrixRTCSessionManagerEvents, RoomEvent } from '$types/matrix-sdk';
import { mDirectAtom } from '$state/mDirectList';
import {
  callEmbedAtom,
  callSoundBlockedAtom,
  incomingCallAtom,
  mutedCallRoomIdAtom,
  type IncomingCall,
} from '$state/callEmbed';
import { settingsAtom } from '$state/settings';
import {
  parseIncomingRtcNotification,
  RTC_DECLINE_EVENT_TYPE,
  REFERENCE_REL_TYPE,
  isRtcNotificationEventType,
} from '$features/call/rtcNotificationParser';
import { decryptRtcTimelineEvent } from '$features/call/callSignalingDecrypt';
import {
  FALLBACK_INTERVAL_MS,
  MAX_NOTIFICATION_LIFETIME_MS,
  OUTGOING_DECLINE_EMBED_CLEAR_MS,
} from '$features/call/callSignalingPolicy';
import {
  applyOutgoingDeclineToTracker,
  type OutgoingDeclineEvent,
} from '$features/call/outgoingDeclineHandler';
import {
  parseRtcDeclineFromTimelineEvent,
  relationFromContent,
} from '$features/call/rtcTimelineDecline';
import { evaluateIncomingCallFallback } from '$features/call/callSignalingFallback';
import { canPlayCallAudio } from '$features/call/callRingtone';
import { dismissSystemCallNotifications } from '$features/call/callNotificationBridge';
import { isIncomingCallSuppressed } from '$features/call/callIncomingIngress';
import {
  getRemoteRtcMemberUserIds,
  isCallActive,
  isOutgoingCallPending,
} from '$features/call/callMembershipState';
import { ringtoneManager } from '$features/call/CallRingtoneManager';
import { OUTGOING_RING_TIMEOUT_MS } from '$features/call/callSignalingPolicy';
import { getSlidingSyncManager } from '$client/initMatrix';
import { LIST_DMS } from '$client/slidingSync';
import { useMatrixClient } from './useMatrixClient';
import { createDebugLogger } from '../utils/debugLogger';

const debugLog = createDebugLogger('CallSignaling');

const CALL_SIGNAL_DM_EXPAND_BATCH = 30;
const CALL_SIGNAL_DM_EXPAND_INTERVAL_MS = 5000;

const canSenderStartCalls = (room: Room, senderId: string): boolean =>
  room.currentState?.maySendStateEvent('org.matrix.msc3401.call.member', senderId) ?? false;

export function useIncomingCallSignaling() {
  const mx = useMatrixClient();
  const store = useStore();
  const callEmbed = useAtomValue(callEmbedAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const settings = useAtomValue(settingsAtom);
  const incomingCall = useAtomValue(incomingCallAtom);
  const mutedRoomId = useAtomValue(mutedCallRoomIdAtom);
  const setIncomingCall = useSetAtom(incomingCallAtom);
  const setMutedRoomId = useSetAtom(mutedCallRoomIdAtom);
  const setCallSoundBlocked = useSetAtom(callSoundBlockedAtom);
  const setCallEmbed = useSetAtom(callEmbedAtom);

  const incomingCallRef = useRef<IncomingCall | null>(incomingCall);
  const mutedRoomIdRef = useRef<string | null>(mutedRoomId);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const MAX_SEEN_NOTIFICATION_IDS = 256;

  const rememberNotificationId = (notificationEventId: string) => {
    const seen = seenNotificationIdsRef.current;
    if (seen.has(notificationEventId)) return false;
    seen.add(notificationEventId);
    while (seen.size > MAX_SEEN_NOTIFICATION_IDS) {
      const oldest = seen.values().next().value;
      if (!oldest) break;
      seen.delete(oldest);
    }
    return true;
  };
  const outgoingRingRoomIdRef = useRef<string | null>(null);
  const declinedOutgoingRoomIdRef = useRef<string | null>(null);
  const outgoingDeclinesRef = useRef<
    Map<string, { notificationEventId: string; declinerIds: Set<string> }>
  >(new Map());
  const outgoingStartRef = useRef<number | null>(null);
  const activeOutgoingNotificationIdRef = useRef<string | null>(null);
  const seenDeclineEventIdsRef = useRef<Set<string>>(new Set());
  const hasCallBeenActiveRef = useRef<boolean>(false);
  const callSubscriptionRoomIdRef = useRef<string | null>(null);
  const dmListExpansionAtRef = useRef<number>(0);
  const mDirectsRef = useRef(mDirects);
  mDirectsRef.current = mDirects;

  type SignalingHandlerRefs = {
    callEmbed: typeof callEmbed;
    mDirects: typeof mDirects;
    outgoingRingbackAllowed: boolean;
    handleIncomingCall: (incoming: IncomingCall) => void;
    handleOutgoingDecline: (decline: {
      roomId: string;
      declineEventId: string;
      notificationEventId: string;
      senderId: string;
    }) => void;
    clearIncomingCall: () => void;
    stopIncomingRing: () => void;
    stopOutgoingRing: () => void;
    setMutedRoomId: (roomId: string | null) => void;
    playIncomingRing: () => void;
  };

  const signalingHandlerRefs = useRef<SignalingHandlerRefs | null>(null);

  incomingCallRef.current = incomingCall;
  mutedRoomIdRef.current = mutedRoomId;

  useEffect(() => {
    declinedOutgoingRoomIdRef.current = null;
    outgoingDeclinesRef.current.clear();
    activeOutgoingNotificationIdRef.current = null;
    seenDeclineEventIdsRef.current.clear();
    hasCallBeenActiveRef.current = false;
    outgoingRingRoomIdRef.current = null;
    outgoingStartRef.current = null;
  }, [callEmbed]);

  useEffect(() => {
    void ringtoneManager
      .syncSources(settings.callRingtoneId, settings.callRingbackTone, settings.callRingtoneVolume)
      .then(() => {
        // resolveCallToneSources reads custom tones from IndexedDB, so this can still be
        // pending when an incoming call arrives (e.g. a cold-launch tap-to-answer
        // notification racing this effect's first run). playIncomingRing()'s earlier call
        // would have seen an empty <audio>.src and resolved immediately without ever
        // actually playing, and nothing re-triggers it once the source loads — re-evaluate
        // now via the ref (not a dep here) so this effect doesn't re-run on every
        // playIncomingRing identity change.
        if (incomingCallRef.current) {
          signalingHandlerRefs.current?.playIncomingRing();
        }
      });
  }, [settings.callRingtoneId, settings.callRingbackTone, settings.callRingtoneVolume]);

  const stopIncomingRing = useCallback(() => {
    ringtoneManager.stopIncoming();
    setCallSoundBlocked(false);
  }, [setCallSoundBlocked]);

  const stopOutgoingRing = useCallback(() => {
    ringtoneManager.stopOutgoing();
  }, []);

  const clearIncomingCall = useCallback(() => {
    const activeIncomingCall = incomingCallRef.current;
    stopIncomingRing();
    setIncomingCall(null);
    if (activeIncomingCall) {
      void dismissSystemCallNotifications(activeIncomingCall.roomId);
    }
  }, [setIncomingCall, stopIncomingRing]);

  const handleOutgoingDecline = useCallback(
    (decline: OutgoingDeclineEvent) => {
      if (!callEmbed || callEmbed.roomId !== decline.roomId) {
        return;
      }

      if (seenDeclineEventIdsRef.current.has(decline.declineEventId)) {
        return;
      }
      seenDeclineEventIdsRef.current.add(decline.declineEventId);

      const activeNotificationId = activeOutgoingNotificationIdRef.current;
      if (activeNotificationId && decline.notificationEventId !== activeNotificationId) {
        debugLog.info('call', 'Ignoring stale outgoing decline for previous notification', {
          roomId: decline.roomId,
          declineEventId: decline.declineEventId,
          notificationEventId: decline.notificationEventId,
          activeNotificationId,
        });
        return;
      }

      const outgoingRoom = mx.getRoom(decline.roomId);
      if (!outgoingRoom) {
        return;
      }

      const myUserId = mx.getSafeUserId();
      const sessionDescription = mx.matrixRTC.getRoomSession(outgoingRoom).sessionDescription;
      let remoteJoinedIds = getRemoteRtcMemberUserIds(myUserId, outgoingRoom, sessionDescription);
      // Only fall back to the decliner as the sole target for direct rooms, where there's
      // exactly one possible remote party anyway. For group calls, an empty target set just
      // means membership state hasn't caught up yet with the decline event — treating the
      // lone decliner as the entire target here would let one decline end a group call that
      // other invitees haven't responded to (applyOutgoingDeclineToTracker already handles a
      // genuinely empty group target set as "ignore, wait for more signal").
      if (remoteJoinedIds.size === 0 && mDirects.has(decline.roomId)) {
        remoteJoinedIds = new Set([decline.senderId]);
      }

      const decision = applyOutgoingDeclineToTracker(outgoingDeclinesRef.current, decline, {
        remoteJoinedIds,
        isDirectRoom: mDirects.has(decline.roomId),
      });

      if (decision.kind === 'ignore_partial') {
        debugLog.info('call', 'Ignoring partial outgoing decline for group call', {
          roomId: decline.roomId,
          declineEventId: decline.declineEventId,
          notificationEventId: decline.notificationEventId,
          declinedCount: decision.declinedCount,
          targetCount: decision.targetCount,
        });
        Sentry.metrics.count('sable.call.outgoing.declined.partial', 1);
        return;
      }

      declinedOutgoingRoomIdRef.current = decline.roomId;
      debugLog.info('call', 'Outgoing call declined and ending call', {
        roomId: decline.roomId,
        declineEventId: decline.declineEventId,
        notificationEventId: decline.notificationEventId,
        declinedCount: decision.declinedCount,
        targetCount: decision.targetCount,
      });
      Sentry.metrics.count('sable.call.outgoing.declined', 1);
      stopOutgoingRing();

      void callEmbed
        .hangup()
        .catch((error) => {
          debugLog.warn('call', 'Failed to hang up after outgoing decline', {
            roomId: decline.roomId,
            error: error instanceof Error ? error.message : String(error),
          });
          Sentry.metrics.count('sable.call.outgoing.decline_hangup_error', 1);
        })
        .finally(() => {
          window.setTimeout(() => {
            const activeEmbed = store.get(callEmbedAtom);
            if (activeEmbed !== callEmbed) return;
            setCallEmbed(undefined);
          }, OUTGOING_DECLINE_EMBED_CLEAR_MS);
        });
    },
    [callEmbed, mDirects, mx, setCallEmbed, stopOutgoingRing, store]
  );

  const callAudioAllowed = canPlayCallAudio({
    isNotificationSounds: settings.isNotificationSounds,
    callSoundOverrideGlobalNotifications: settings.callSoundOverrideGlobalNotifications,
  });
  const incomingRingtoneAllowed = settings.incomingCallSoundEnabled && callAudioAllowed;
  const outgoingRingbackAllowed =
    settings.outgoingRingbackEnabled && callAudioAllowed && settings.callRingbackTone !== 'silent';
  const incomingToneIsSilent = settings.callRingtoneId === 'silent';

  const handleIncomingCall = useCallback(
    (nextIncomingCall: IncomingCall) => {
      if (
        isIncomingCallSuppressed(
          nextIncomingCall,
          mutedRoomIdRef.current,
          settings.incomingVoiceRoomCallSoundEnabled
        )
      )
        return;
      if (!rememberNotificationId(nextIncomingCall.notificationEventId)) return;
      setIncomingCall(nextIncomingCall);

      debugLog.info('call', 'Incoming RTC notification accepted', {
        roomId: nextIncomingCall.roomId,
        notificationType: nextIncomingCall.notificationType,
        intent: nextIncomingCall.intentRaw,
      });
      Sentry.metrics.count('sable.call.incoming.shown', 1, {
        attributes: {
          type: nextIncomingCall.notificationType,
          dm: String(nextIncomingCall.isDirect),
        },
      });
    },
    [setIncomingCall, settings.incomingVoiceRoomCallSoundEnabled]
  );

  const playIncomingRing = useCallback(() => {
    if (!incomingRingtoneAllowed || incomingToneIsSilent) {
      stopIncomingRing();
      return;
    }

    ringtoneManager
      .playIncoming()
      ?.then(() => {
        setCallSoundBlocked(false);
      })
      .catch(() => {
        // AbortError is handled in ringtoneManager, any other error comes here
        setCallSoundBlocked(true);
      });
  }, [incomingRingtoneAllowed, incomingToneIsSilent, setCallSoundBlocked, stopIncomingRing]);

  signalingHandlerRefs.current = {
    callEmbed,
    mDirects,
    outgoingRingbackAllowed,
    handleIncomingCall,
    handleOutgoingDecline,
    clearIncomingCall,
    stopIncomingRing,
    stopOutgoingRing,
    setMutedRoomId,
    playIncomingRing,
  };

  useEffect(() => {
    if (!incomingRingtoneAllowed) {
      stopIncomingRing();
    }
    if (!outgoingRingbackAllowed) {
      stopOutgoingRing();
    }
  }, [incomingRingtoneAllowed, outgoingRingbackAllowed, stopIncomingRing, stopOutgoingRing]);

  useEffect(() => {
    if (!incomingCall) {
      stopIncomingRing();
      return;
    }
    if (
      isIncomingCallSuppressed(
        incomingCall,
        mutedRoomId,
        settings.incomingVoiceRoomCallSoundEnabled
      )
    ) {
      setIncomingCall(null);
      return;
    }
    playIncomingRing();
  }, [
    incomingCall,
    mutedRoomId,
    playIncomingRing,
    setIncomingCall,
    settings.incomingVoiceRoomCallSoundEnabled,
    stopIncomingRing,
  ]);

  useEffect(() => {
    if (!mx || !mx.matrixRTC) return undefined;

    const myUserId = mx.getSafeUserId();
    const handlers = () => signalingHandlerRefs.current!;

    const parseEvent = async (
      event: MatrixEvent,
      room: Room,
      liveEvent: boolean
    ): Promise<IncomingCall | undefined> => {
      let eventType = event.getType();
      let content = event.getContent();

      if (event.isEncrypted()) {
        const decrypted = await decryptRtcTimelineEvent(event, mx);
        if (!decrypted?.content || !decrypted.type) {
          Sentry.metrics.count('sable.call.signal.decrypt_timeout', 1);
          return undefined;
        }
        eventType = decrypted.type;
        content = decrypted.content;
      }

      // Read after decryption: for encrypted events, m.relates_to normally only
      // becomes visible once the ciphertext above has been decrypted.
      const relation = event.getRelation() ?? relationFromContent(content);
      if (relation?.rel_type !== REFERENCE_REL_TYPE || !relation.event_id) return undefined;

      const parsed = await parseIncomingRtcNotification(
        {
          type: eventType,
          sender: event.getSender() ?? '',
          roomId: room.roomId,
          eventId: event.getId() ?? '',
          originServerTs: event.getTs(),
          content,
          relation: {
            rel_type: relation.rel_type,
            event_id: relation.event_id,
          },
          isLiveEvent: liveEvent,
          isEncrypted: false,
        },
        {
          myUserId,
          now: Date.now(),
          maxLifetimeMs: MAX_NOTIFICATION_LIFETIME_MS,
        }
      );

      if (!parsed) return undefined;
      if (!canSenderStartCalls(room, parsed.senderId)) {
        debugLog.warn('call', 'Rejected incoming call without call-member permission', {
          roomId: room.roomId,
          senderId: parsed.senderId,
        });
        return undefined;
      }

      return {
        ...parsed,
        isDirect: handlers().mDirects.has(room.roomId),
      };
    };

    let timelineHandlerEpoch = 0;

    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = async (
      event,
      room,
      _toStartOfTimeline,
      _removed,
      data
    ) => {
      if (!room || !data.liveEvent) return;

      const epochAtStart = timelineHandlerEpoch;
      const isStale = () => epochAtStart !== timelineHandlerEpoch;

      const relation = event.getRelation();
      if (relation?.rel_type !== REFERENCE_REL_TYPE && !event.isEncrypted()) return;

      const type = event.getType();
      if (
        !isRtcNotificationEventType(type) &&
        type !== RTC_DECLINE_EVENT_TYPE &&
        !event.isEncrypted()
      ) {
        return;
      }
      const senderId = event.getSender();
      const eventId = event.getId();
      if (!senderId || !eventId) return;

      if (senderId === myUserId) {
        // For an E2EE outgoing call, the local echo of our own RTC notification arrives
        // as m.room.encrypted — type here is the pre-decryption type, so it never equals
        // the notification type and activeOutgoingNotificationIdRef never gets set.
        // handleOutgoingDecline only filters stale declines when that ref is populated,
        // so without this a delayed decline for a previous notification in the same room
        // could hang up a new encrypted outgoing call. Decrypt to check the real type.
        let selfEventType = type;
        if (event.isEncrypted() && !event.isDecryptionFailure()) {
          const decrypted = await decryptRtcTimelineEvent(event, mx);
          if (decrypted?.type) selfEventType = decrypted.type;
        }
        if (
          isRtcNotificationEventType(selfEventType) &&
          handlers().callEmbed?.roomId === room.roomId
        ) {
          activeOutgoingNotificationIdRef.current = eventId;
        }
        return;
      }

      const incoming = await parseEvent(event, room, data.liveEvent);
      if (isStale()) return;
      if (incoming) {
        handlers().handleIncomingCall(incoming);
        return;
      }

      // Only inspect declines for the active outgoing call room. Cleartext declines are
      // cheap; encrypted events are decrypted only when they might be RTC declines.
      const activeEmbed = handlers().callEmbed;
      if (!activeEmbed || activeEmbed.roomId !== room.roomId) {
        return;
      }
      if (event.isDecryptionFailure()) {
        return;
      }
      // Re-read type/relation instead of the pre-decryption `type`/`relation` captured
      // above: parseEvent already decrypted this event as a side effect (for any
      // encrypted event, regardless of whether it turned out to be a notification), so
      // by this point an encrypted decline's m.relates_to is visible via these getters.
      // Using the stale pre-decrypt values meant encrypted declines were never even
      // handed to parseRtcDeclineFromTimelineEvent, so remote declines in E2EE outgoing
      // calls were silently ignored and the caller kept ringing.
      const shouldCheckDecline =
        event.getType() === RTC_DECLINE_EVENT_TYPE ||
        (event.isEncrypted() && event.getRelation()?.rel_type === REFERENCE_REL_TYPE);
      if (!shouldCheckDecline) {
        return;
      }

      const decline = await parseRtcDeclineFromTimelineEvent(
        event,
        room,
        data.liveEvent,
        myUserId,
        mx
      );
      if (isStale()) return;
      if (decline) {
        handlers().handleOutgoingDecline(decline);
      }
    };

    const fallbackContext = {
      myUserId,
      getRoom: (roomId: string) => mx.getRoom(roomId),
      getSessionDescription: (room: Room) => mx.matrixRTC.getRoomSession(room).sessionDescription,
    };

    const evaluateIncomingFallback = () => {
      const action = evaluateIncomingCallFallback(
        incomingCallRef.current,
        Date.now(),
        fallbackContext
      );
      if (action.kind !== 'clear') return;

      if (action.reason === 'expired') {
        const currentIncoming = incomingCallRef.current;
        debugLog.info('call', 'Incoming call timed out', {
          roomId: currentIncoming?.roomId,
          notificationEventId: currentIncoming?.notificationEventId,
        });
        Sentry.metrics.count('sable.call.timeout', 1);
      } else if (action.reason === 'membership_dropped') {
        debugLog.info('call', 'Incoming call cleared after membership drop', {
          roomId: incomingCallRef.current?.roomId,
        });
      }

      handlers().clearIncomingCall();
    };

    let outgoingRingTimeoutId: number | undefined;

    const evaluateOutgoingFallback = () => {
      const activeCallRoomId = handlers().callEmbed?.roomId;

      const stop = () => {
        handlers().stopOutgoingRing();
        window.clearTimeout(outgoingRingTimeoutId);
        outgoingRingTimeoutId = undefined;
      };

      if (
        !activeCallRoomId ||
        !handlers().outgoingRingbackAllowed ||
        declinedOutgoingRoomIdRef.current === activeCallRoomId
      ) {
        outgoingRingRoomIdRef.current = null;
        outgoingStartRef.current = null;
        return stop();
      }

      if (!handlers().mDirects.has(activeCallRoomId)) {
        return stop();
      }

      const outgoingRoom = mx.getRoom(activeCallRoomId);
      if (!outgoingRoom) {
        return stop();
      }

      const session = mx.matrixRTC.getRoomSession(outgoingRoom).sessionDescription;

      if (isCallActive(myUserId, outgoingRoom, session)) {
        hasCallBeenActiveRef.current = true;
      }

      if (hasCallBeenActiveRef.current) {
        return stop();
      }

      const isPending = isOutgoingCallPending(myUserId, outgoingRoom, session);
      if (!isPending) {
        return stop();
      }

      if (!outgoingStartRef.current || outgoingRingRoomIdRef.current !== activeCallRoomId) {
        outgoingStartRef.current = Date.now();
        outgoingRingRoomIdRef.current = activeCallRoomId;
        debugLog.info('call', 'Outgoing ringing fallback started', { roomId: activeCallRoomId });
        ringtoneManager.playOutgoing();

        window.clearTimeout(outgoingRingTimeoutId);
        outgoingRingTimeoutId = window.setTimeout(() => {
          stop();
        }, OUTGOING_RING_TIMEOUT_MS);
      }
    };

    const evaluateFallbackState = () => {
      evaluateIncomingFallback();
      evaluateOutgoingFallback();
    };

    const handleSessionEnded = (roomId: string) => {
      if (mutedRoomIdRef.current === roomId) handlers().setMutedRoomId(null);
      evaluateFallbackState();
    };

    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    mx.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionStarted, evaluateFallbackState);
    mx.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionEnded, handleSessionEnded);

    const intervalId = window.setInterval(evaluateFallbackState, FALLBACK_INTERVAL_MS);
    evaluateFallbackState();

    return () => {
      timelineHandlerEpoch += 1;
      mx.off(RoomEvent.Timeline, handleTimelineEvent);
      mx.matrixRTC.off(MatrixRTCSessionManagerEvents.SessionStarted, evaluateFallbackState);
      mx.matrixRTC.off(MatrixRTCSessionManagerEvents.SessionEnded, handleSessionEnded);
      window.clearInterval(intervalId);
      // handlers() reads from a ref reflecting *current* signaling state, not this
      // effect instance's closure — so if mx changes (session switch) while this
      // timeout is pending, an uncleared one would fire later and call
      // handlers().stopOutgoingRing() against the new session, prematurely stopping an
      // unrelated new call's ringback.
      window.clearTimeout(outgoingRingTimeoutId);
      handlers().stopIncomingRing();
      handlers().stopOutgoingRing();
    };
  }, [mx]);

  // Subscribe the active call room to sliding sync for real-time events.
  useEffect(() => {
    const slidingSyncManager = getSlidingSyncManager(mx);
    if (!slidingSyncManager) return undefined;

    const activeCallRoomId = incomingCall?.roomId ?? callEmbed?.roomId ?? null;
    const previousCallRoomId = callSubscriptionRoomIdRef.current;

    if (activeCallRoomId === previousCallRoomId) return undefined;

    if (previousCallRoomId) slidingSyncManager.unsubscribeFromRoom(previousCallRoomId);
    if (activeCallRoomId) slidingSyncManager.subscribeToRoom(activeCallRoomId);
    callSubscriptionRoomIdRef.current = activeCallRoomId;

    return () => {
      // Unsubscribe on unmount so rooms don't remain pinned in sliding sync.
      if (callSubscriptionRoomIdRef.current) {
        slidingSyncManager.unsubscribeFromRoom(callSubscriptionRoomIdRef.current);
        callSubscriptionRoomIdRef.current = null;
      }
    };
  }, [incomingCall, callEmbed, mx]);

  // Periodically expand the DM sliding-sync list window while idle so that
  // incoming calls in not-yet-loaded DM rooms can be detected.
  useEffect(() => {
    const slidingSyncManager = getSlidingSyncManager(mx);
    if (!slidingSyncManager) return undefined;

    const tryExpandDmList = () => {
      if (incomingCallRef.current || callEmbed) return;

      const unloadedDmCount = [...mDirectsRef.current].filter((id) => !mx.getRoom(id)).length;
      if (unloadedDmCount === 0) return;

      const dmDiagnostics = slidingSyncManager.getListDiagnostics(LIST_DMS);
      const canExpand =
        dmDiagnostics &&
        dmDiagnostics.knownCount > 0 &&
        dmDiagnostics.rangeEnd < dmDiagnostics.knownCount - 1;

      const now = Date.now();
      if (canExpand && now - dmListExpansionAtRef.current >= CALL_SIGNAL_DM_EXPAND_INTERVAL_MS) {
        dmListExpansionAtRef.current = now;
        slidingSyncManager.requestListWindow(
          LIST_DMS,
          dmDiagnostics.rangeEnd + CALL_SIGNAL_DM_EXPAND_BATCH
        );
      }
    };

    const intervalId = window.setInterval(tryExpandDmList, CALL_SIGNAL_DM_EXPAND_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [mx, callEmbed]);

  return null;
}
