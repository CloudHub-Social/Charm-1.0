import type { IncomingCall } from '$state/callEmbed';
import type { Room } from '$types/matrix-sdk';
import type { SessionDescription } from './callMembershipState';
import { isIncomingCallActive } from './callMembershipState';
import { INCOMING_MEMBERSHIP_GRACE_MS } from './callSignalingPolicy';

export type IncomingFallbackAction =
  | { kind: 'none' }
  | { kind: 'clear'; reason: 'expired' | 'missing_room' | 'membership_dropped' };

export type IncomingFallbackContext = {
  myUserId: string;
  getRoom: (roomId: string) => Room | null | undefined;
  getSessionDescription: (room: Room) => SessionDescription;
  isIncomingActive?: typeof isIncomingCallActive;
};

export const evaluateIncomingCallFallback = (
  incoming: IncomingCall | null,
  now: number,
  context: IncomingFallbackContext
): IncomingFallbackAction => {
  if (!incoming) return { kind: 'none' };
  if (now >= incoming.expiresAt) return { kind: 'clear', reason: 'expired' };

  const incomingRoom = context.getRoom(incoming.roomId);
  if (!incomingRoom) {
    // On a cold launch (e.g. tap-to-answer from a notification) initial sync may not have
    // delivered this room yet. Treat it as pending — not gone — until the grace window
    // passes or the call's own expiry above fires, rather than dropping the incoming-call
    // UI the instant sync hasn't caught up.
    if (now - incoming.senderTs < INCOMING_MEMBERSHIP_GRACE_MS) {
      return { kind: 'none' };
    }
    return { kind: 'clear', reason: 'missing_room' };
  }

  const sessionDescription = context.getSessionDescription(incomingRoom);
  const isIncomingActive = context.isIncomingActive ?? isIncomingCallActive;
  if (isIncomingActive(context.myUserId, incomingRoom, sessionDescription)) {
    return { kind: 'none' };
  }

  // Session membership can lag behind live RTC notification delivery.
  if (now - incoming.senderTs < INCOMING_MEMBERSHIP_GRACE_MS) {
    return { kind: 'none' };
  }

  return { kind: 'clear', reason: 'membership_dropped' };
};
