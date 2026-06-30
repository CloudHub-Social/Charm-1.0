import { describe, expect, it, vi } from 'vitest';
import { EventType, MsgType, NotificationCountType, ReceiptType } from '$types/matrix-sdk';
import type { MatrixClient, MatrixEvent, Room } from '$types/matrix-sdk';
import { CustomAccountDataEvent } from '$types/matrix/accountData';
import {
  getRoomReadMarkerId,
  getUnreadInfo,
  isNotificationEvent,
  resolveSpaceNavigationRoot,
  roomHaveUnread,
} from './room';

const USER_ID = '@alice:example.com';

function makeClient(): MatrixClient {
  return {
    getUserId: () => USER_ID,
    getAccountData: () => undefined,
    getRoomPushRule: vi.fn<() => undefined>(),
    fetchRoomEvent: vi.fn<() => Promise<undefined>>(() => Promise.resolve(undefined)),
  } as unknown as MatrixClient;
}

function makeEvent(eventId: string, sender = '@bob:example.com', ts = 1000): MatrixEvent {
  return {
    getId: () => eventId,
    getSender: () => sender,
    getTs: () => ts,
    getType: () => EventType.RoomMessage,
    getContent: () => ({ msgtype: MsgType.Text, body: 'hello' }),
    getRelation: () => undefined,
    isRedacted: () => false,
    isSending: () => false,
  } as unknown as MatrixEvent;
}

function makeReactionEvent(
  eventId: string,
  relatedEventId: string,
  sender = '@bob:example.com'
): MatrixEvent {
  return {
    getId: () => eventId,
    getSender: () => sender,
    getType: () => EventType.Reaction,
    getContent: () => ({ 'm.relates_to': { rel_type: 'm.annotation', event_id: relatedEventId } }),
    getRelation: () => ({ rel_type: 'm.annotation', event_id: relatedEventId }),
    isRedacted: () => false,
    isSending: () => false,
  } as unknown as MatrixEvent;
}

function makeRoom(params: {
  readUpToId?: string;
  receiptTs?: number;
  fullyReadId?: string;
  events: MatrixEvent[];
  total?: number;
  highlight?: number;
  roomHighlight?: number;
}): Room {
  const client = makeClient();
  return {
    roomId: '!room:example.com',
    client,
    emit: vi.fn<() => boolean>(),
    getEventReadUpTo: () => params.readUpToId,
    getAccountData: (eventType: string) =>
      eventType === EventType.FullyRead && params.fullyReadId
        ? ({
            getContent: () => ({ event_id: params.fullyReadId }),
          } as unknown as MatrixEvent)
        : undefined,
    getLiveTimeline: () => ({
      getEvents: () => params.events,
    }),
    findEventById: (eventId: string) => params.events.find((event) => event.getId() === eventId),
    getReadReceiptForUserId: (
      _userId: string,
      _ignoreSynthesized?: boolean,
      receiptType?: ReceiptType
    ) =>
      !params.readUpToId || receiptType === ReceiptType.ReadPrivate
        ? null
        : ({ eventId: params.readUpToId, data: { ts: params.receiptTs } } as unknown as ReturnType<
            Room['getReadReceiptForUserId']
          >),
    getUnreadNotificationCount: (type: NotificationCountType) =>
      type === NotificationCountType.Highlight ? (params.highlight ?? 0) : (params.total ?? 0),
    getRoomUnreadNotificationCount: (type = NotificationCountType.Total) =>
      type === NotificationCountType.Highlight
        ? (params.roomHighlight ?? params.highlight ?? 0)
        : (params.total ?? 0),
    hasUserReadEvent: (_userId: string, eventId: string) => eventId === params.readUpToId,
    fixupNotifications: vi.fn<() => void>(),
  } as unknown as Room;
}

function makeSpaceRoom(
  roomId: string,
  options?: { membership?: string; childIds?: string[] }
): Room {
  return {
    roomId,
    isSpaceRoom: () => true,
    getMyMembership: () => options?.membership ?? 'join',
    getLiveTimeline: () => ({
      getState: () => ({
        getStateEvents: (eventType: string) => {
          if (eventType === EventType.RoomCreate) {
            return {
              getContent: () => ({ type: 'm.space' }),
            };
          }
          if (eventType === EventType.SpaceChild) {
            return (options?.childIds ?? []).map((childId) => ({
              getType: () => EventType.SpaceChild,
              getStateKey: () => childId,
              getContent: () => ({ via: ['example.com'] }),
            }));
          }
          return [];
        },
      }),
    }),
  } as unknown as Room;
}

describe('room read markers', () => {
  it('treats reactions to the current user messages as notification events only with context', () => {
    const root = makeEvent('$event1', USER_ID);
    const reaction = makeReactionEvent('$event2', '$event1');
    const room = makeRoom({
      fullyReadId: '$event1',
      events: [root, reaction],
    });

    expect(isNotificationEvent(reaction)).toBe(false);
    expect(isNotificationEvent(reaction, room, USER_ID)).toBe(true);
  });

  it('does not treat reactions to other users messages as notification events', () => {
    const root = makeEvent('$event1', '@carol:example.com');
    const reaction = makeReactionEvent('$event2', '$event1');
    const room = makeRoom({
      fullyReadId: '$event1',
      events: [root, reaction],
    });

    expect(isNotificationEvent(reaction, room, USER_ID)).toBe(false);
  });

  it('falls back to m.fully_read when a receipt is not available', () => {
    const room = makeRoom({ fullyReadId: '$event1', events: [makeEvent('$event1')] });

    expect(getRoomReadMarkerId(room, USER_ID)).toBe('$event1');
  });

  it('prefers m.fully_read when it is newer than the receipt in the live timeline', () => {
    const room = makeRoom({
      readUpToId: '$event1',
      fullyReadId: '$event3',
      events: [makeEvent('$event1'), makeEvent('$event2'), makeEvent('$event3')],
    });

    expect(getRoomReadMarkerId(room, USER_ID)).toBe('$event3');
  });

  it('keeps the receipt when it is newer than m.fully_read in the live timeline', () => {
    const room = makeRoom({
      readUpToId: '$event3',
      fullyReadId: '$event1',
      events: [makeEvent('$event1'), makeEvent('$event2'), makeEvent('$event3')],
    });

    expect(getRoomReadMarkerId(room, USER_ID)).toBe('$event3');
  });

  it('does not treat non-live hydrated events before m.fully_read as unread', () => {
    const room = makeRoom({
      fullyReadId: '$event2',
      events: [makeEvent('$event1'), makeEvent('$event2')],
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('treats hydrated events after m.fully_read as unread', () => {
    const room = makeRoom({
      fullyReadId: '$event1',
      events: [makeEvent('$event1'), makeEvent('$event2')],
    });

    expect(roomHaveUnread(room.client, room)).toBe(true);
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 1,
    });
  });

  it('does not infer unread state from hydrated timeline events without a read marker', () => {
    const room = makeRoom({
      events: [makeEvent('$event1')],
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('clamps stale SDK counts when m.fully_read is the only read marker', () => {
    const room = makeRoom({
      fullyReadId: '$event2',
      events: [makeEvent('$event1'), makeEvent('$event2')],
      total: 1,
    });

    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('suppresses stale counts when the current user sent the latest hydrated event', () => {
    const room = makeRoom({
      fullyReadId: '$event1',
      events: [makeEvent('$event1'), makeEvent('$event2', USER_ID)],
      total: 1,
    });

    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('clamps inflated sliding-sync counts to unread events visible after the read marker', () => {
    const room = makeRoom({
      fullyReadId: '$event1',
      events: [makeEvent('$event1'), makeEvent('$event2'), makeEvent('$event3')],
      total: 30,
    });

    expect(getUnreadInfo(room, { applyFixup: true })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 2,
    });
  });

  it('clamps phantom highlight count when the room is fully read', () => {
    const room = makeRoom({
      readUpToId: '$event2',
      events: [makeEvent('$event1'), makeEvent('$event2')],
      total: 5,
      highlight: 2,
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('preserves thread-level highlights while clamping phantom room-level highlights', () => {
    const room = makeRoom({
      readUpToId: '$event2',
      events: [makeEvent('$event1'), makeEvent('$event2')],
      // total = 7 = 5 stale room-level + 2 thread-level (getUnreadNotificationCount)
      // roomHighlight = 1 stale room-level; actual highlight = 1 (room) + 1 (thread) = 2
      total: 5,
      highlight: 2,
      roomHighlight: 1,
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    // After clamping: total -= roomTotal(5) = -3 → Math.max(0, highlight - roomHighlight(1)) = 1
    // But total is clamped by the overall subtraction path...
    // Actually total = getUnreadNotificationCount(Total) = params.total = 5
    // total -= roomTotal(5) = 0; highlight = max(0, 2 - 1) = 1
    // Returns { total: max(0, 1) = 1, highlight: 1 }
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 1,
      total: 1,
    });
  });

  it('does not clamp highlight counts in state-only rooms with an empty live timeline', () => {
    const room = makeRoom({
      readUpToId: '$read-marker',
      events: [],
      total: 5,
      highlight: 2,
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    // latestNotificationId is null (no events) → shouldClamp = liveEvents.length > 0 = false
    // Server counts preserved: real highlights must not be cleared before timeline hydration.
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 2,
      total: 5,
    });
  });

  it('clamps stale server count when read marker is in timeline but no notification events exist', () => {
    // Simulates a bridge-heavy room where recent events are all metadata (topic changes,
    // membership updates, etc.) — none are notification events.  The user just marked as
    // read at the latest event so the read marker IS in the live timeline, even though
    // latestNotificationId resolves to undefined.  The server still reports total: 25 (stale).
    const stateEvent1 = {
      getId: () => '$state1',
      getSender: () => '@bridgebot:example.com',
      getType: () => 'm.room.topic',
      getContent: () => ({}),
      getRelation: () => undefined,
      isRedacted: () => false,
      isSending: () => false,
    } as unknown as MatrixEvent;
    const stateEvent2 = {
      getId: () => '$state2',
      getSender: () => '@bridgebot:example.com',
      getType: () => 'm.room.topic',
      getContent: () => ({}),
      getRelation: () => undefined,
      isRedacted: () => false,
      isSending: () => false,
    } as unknown as MatrixEvent;
    const room = makeRoom({
      readUpToId: '$state2',
      events: [stateEvent1, stateEvent2],
      total: 25,
      highlight: 0,
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('clears a phantom count when the read receipt resolves to the user’s own event', () => {
    // Receipt parks on one of the user's own events (e.g. a bridged edit) that
    // sits in the timeline; the latest visible event is from someone else, so the
    // "own latest hydrated event" path does not fire. Layer 1 own-event clamp.
    const room = makeRoom({
      readUpToId: '$mine',
      events: [makeEvent('$event1'), makeEvent('$mine', USER_ID), makeEvent('$event3')],
      total: 3,
    });

    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('clears a phantom count when the receipt points at an unresolvable event newer than visible', () => {
    // Mirrors the mautrix double-puppet wedge: the receipt targets a hidden event
    // (not in the loaded timeline) whose receipt ts is newer than the newest
    // visible message. Layer 2 timestamp heuristic, gated to the unresolvable case.
    const room = makeRoom({
      readUpToId: '$hiddenEdit',
      receiptTs: 5000,
      events: [
        makeEvent('$event1', '@bob:example.com', 1000),
        makeEvent('$event2', '@bob:example.com', 2000),
      ],
      total: 3,
    });

    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });

  it('does NOT clear when an unresolvable receipt is older than visible (bridge backfill)', () => {
    // A genuinely-unread message can carry an old origin_server_ts (Discord
    // preserves timestamps) yet arrive after the receipt. Layer 2 must not clamp
    // here: receipt ts is older than the newest visible event.
    const room = makeRoom({
      readUpToId: '$hiddenOld',
      receiptTs: 1000,
      events: [
        makeEvent('$event1', '@bob:example.com', 2000),
        makeEvent('$event2', '@bob:example.com', 3000),
      ],
      total: 2,
    });

    expect(getUnreadInfo(room, { applyFixup: false }).total).toBeGreaterThan(0);
  });

  it('does not synthesize a phantom dot when only a non-notifying reaction is unread', () => {
    const room = makeRoom({
      fullyReadId: '$event1',
      events: [makeEvent('$event1', USER_ID), makeReactionEvent('$event2', '$event1')],
    });

    expect(roomHaveUnread(room.client, room)).toBe(false);
    expect(getUnreadInfo(room, { applyFixup: false })).toEqual({
      roomId: '!room:example.com',
      highlight: 0,
      total: 0,
    });
  });
});

describe('resolveSpaceNavigationRoot', () => {
  it('rejects stale stored roots that are not joined in the live client graph', () => {
    const joinedRoot = makeSpaceRoom('!joined-space:example.com', {
      childIds: ['!room:example.com'],
    });
    const staleRoot = makeSpaceRoom('!stale-space:example.com', {
      membership: 'leave',
    });

    const mx = {
      getRoom: (roomId: string) =>
        roomId === joinedRoot.roomId ? joinedRoot : roomId === staleRoot.roomId ? staleRoot : null,
      getRooms: () => [joinedRoot, staleRoot],
    } as unknown as MatrixClient;

    const cachedRoomToParents = new Map<string, Set<string>>([
      ['!room:example.com', new Set([staleRoot.roomId])],
    ]);

    expect(
      resolveSpaceNavigationRoot(mx, cachedRoomToParents, '!room:example.com', {
        storedRootSpaceId: staleRoot.roomId,
      })
    ).toEqual({
      rootSpaceId: joinedRoot.roomId,
      source: 'preferred_chain',
    });
  });

  it('prefers the shortest sidebar-pinned ancestor path over a longer fallback chain', () => {
    const roomId = '!room:example.com';
    const groupingSpaceId = '!grouping-space:example.com';
    const shortcutRootSpaceId = '!shortcut-root:example.com';
    const longRootSpaceId = '!long-root:example.com';

    const groupingSpace = makeSpaceRoom(groupingSpaceId, { childIds: [roomId] });
    const shortcutRoot = makeSpaceRoom(shortcutRootSpaceId, { childIds: [groupingSpaceId] });
    const longRoot = makeSpaceRoom(longRootSpaceId, { childIds: [shortcutRootSpaceId] });

    const mx = {
      getRoom: (targetRoomId: string) => {
        if (targetRoomId === groupingSpaceId) return groupingSpace;
        if (targetRoomId === shortcutRootSpaceId) return shortcutRoot;
        if (targetRoomId === longRootSpaceId) return longRoot;
        return null;
      },
      getRooms: () => [groupingSpace, shortcutRoot, longRoot],
      getAccountData: (eventType: string) =>
        eventType === CustomAccountDataEvent.CinnySpaces
          ? ({
              getContent: () => ({
                sidebar: [longRootSpaceId, shortcutRootSpaceId],
              }),
            } as unknown as MatrixEvent)
          : undefined,
    } as unknown as MatrixClient;

    const roomToParents = new Map<string, Set<string>>([
      [roomId, new Set([groupingSpaceId])],
      [groupingSpaceId, new Set([shortcutRootSpaceId])],
      [shortcutRootSpaceId, new Set([longRootSpaceId])],
    ]);

    expect(resolveSpaceNavigationRoot(mx, roomToParents, roomId)).toEqual({
      rootSpaceId: shortcutRootSpaceId,
      source: 'sidebar_shortcut',
    });
  });

  it('treats spaces pinned inside sidebar folders as valid sidebar roots', () => {
    const roomId = '!room:example.com';
    const groupingSpaceId = '!grouping-space:example.com';
    const folderPinnedSpaceId = '!folder-pinned-space:example.com';
    const longRootSpaceId = '!long-root:example.com';

    const groupingSpace = makeSpaceRoom(groupingSpaceId, { childIds: [roomId] });
    const folderPinnedSpace = makeSpaceRoom(folderPinnedSpaceId, { childIds: [groupingSpaceId] });
    const longRoot = makeSpaceRoom(longRootSpaceId, { childIds: [folderPinnedSpaceId] });

    const mx = {
      getRoom: (targetRoomId: string) => {
        if (targetRoomId === groupingSpaceId) return groupingSpace;
        if (targetRoomId === folderPinnedSpaceId) return folderPinnedSpace;
        if (targetRoomId === longRootSpaceId) return longRoot;
        return null;
      },
      getRooms: () => [groupingSpace, folderPinnedSpace, longRoot],
      getAccountData: (eventType: string) =>
        eventType === CustomAccountDataEvent.CinnySpaces
          ? ({
              getContent: () => ({
                sidebar: [
                  {
                    id: 'folder-1',
                    content: [folderPinnedSpaceId],
                  },
                  longRootSpaceId,
                ],
              }),
            } as unknown as MatrixEvent)
          : undefined,
    } as unknown as MatrixClient;

    const roomToParents = new Map<string, Set<string>>([
      [roomId, new Set([groupingSpaceId])],
      [groupingSpaceId, new Set([folderPinnedSpaceId])],
      [folderPinnedSpaceId, new Set([longRootSpaceId])],
    ]);

    expect(resolveSpaceNavigationRoot(mx, roomToParents, roomId)).toEqual({
      rootSpaceId: folderPinnedSpaceId,
      source: 'sidebar_shortcut',
    });
  });
});
