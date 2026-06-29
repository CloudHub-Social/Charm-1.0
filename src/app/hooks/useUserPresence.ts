import { useEffect, useMemo, useState } from 'react';
import type { MatrixEvent, User, UserEventHandlerMap } from '$types/matrix-sdk';
import { ClientEvent, UserEvent } from '$types/matrix-sdk';
import { useMatrixClient } from './useMatrixClient';

export enum Presence {
  Online = 'online',
  Unavailable = 'unavailable',
  Offline = 'offline',
  // DND is not a native Matrix state; Sable encodes it as online + status_msg='dnd'.
  Dnd = 'dnd',
}

export type UserPresence = {
  presence: Presence;
  status?: string;
  active: boolean;
  lastActiveTs?: number;
};

const getUserPresence = (user: User): UserPresence => {
  const rawPresence = user.presence as Presence;
  const statusMsg = user.presenceStatusMsg ?? '';
  // DND is encoded as online + status_msg starting with '[dnd]'. Decode it back
  // so the badge renders red for any Sable client, not just the sender's own account switcher.
  const isDnd = rawPresence === Presence.Online && statusMsg.startsWith('[dnd]');
  const presence = isDnd ? Presence.Dnd : rawPresence;

  // Strip the [dnd] prefix when displaying status in Sable
  let displayStatus: string | undefined;
  if (isDnd) {
    // Remove '[dnd]' prefix and any following space, show remaining custom status
    const withoutPrefix = statusMsg.slice(5).trimStart();
    displayStatus = withoutPrefix || undefined;
  } else {
    displayStatus = statusMsg || undefined;
  }

  return {
    presence,
    status: displayStatus,
    active: user.currentlyActive,
    lastActiveTs: user.getLastActiveTs(),
  };
};

export const useUserPresence = (userId: string): UserPresence | undefined => {
  const mx = useMatrixClient();
  const user = mx.getUser(userId);
  const [presence, setPresence] = useState(() => (user ? getUserPresence(user) : undefined));

  useEffect(() => {
    if (!user) {
      setPresence(undefined);

      // When the user isn't in the SDK store yet (e.g., presence arrived before
      // any membership event), listen on the client for incoming events so we
      // can re-evaluate once a presence event for this user is stored.
      const handleEvent = (event: MatrixEvent) => {
        if (event.getType() !== 'm.presence') return;
        // MSC4186 sliding sync presence events may carry the user ID in
        // content.user_id rather than the sender field.
        const sender = event.getSender() ?? (event.getContent().user_id as string | undefined);
        if (sender !== userId) return;
        const latestUser = mx.getUser(userId);
        if (latestUser) setPresence(getUserPresence(latestUser));
      };
      mx.on(ClientEvent.Event, handleEvent);
      return () => {
        mx.removeListener(ClientEvent.Event, handleEvent);
      };
    }
    setPresence(getUserPresence(user));
    const updatePresence: UserEventHandlerMap[UserEvent.Presence] = (e, u) => {
      if (u.userId === user.userId) {
        setPresence(getUserPresence(user));
      }
    };
    user.on(UserEvent.Presence, updatePresence);
    user.on(UserEvent.CurrentlyActive, updatePresence);
    user.on(UserEvent.LastPresenceTs, updatePresence);

    // Synapse's MSC4186 simplified sliding sync has no presence extension, so
    // presence events never arrive over the sync stream.  If lastPresenceTs is
    // still 0 we have never received presence data for this user — fall back to
    // a direct REST call so badges appear on first render.
    if (user.lastPresenceTs === 0) {
      mx.getPresence(userId)
        .then((status) => {
          user.presence = status.presence;
          user.presenceStatusMsg = status.status_msg;
          user.currentlyActive = status.currently_active ?? false;
          user.lastActiveAgo = status.last_active_ago ?? 0;
          user.lastPresenceTs = Date.now();
          setPresence(getUserPresence(user));
        })
        .catch(() => {
          // Presence unavailable or disabled on this server — stay offline.
        });
    }

    return () => {
      user.removeListener(UserEvent.Presence, updatePresence);
      user.removeListener(UserEvent.CurrentlyActive, updatePresence);
      user.removeListener(UserEvent.LastPresenceTs, updatePresence);
    };
  }, [mx, user, userId]);

  return presence;
};

export const usePresenceLabel = (): Record<Presence, string> =>
  useMemo(
    () => ({
      [Presence.Online]: 'Active',
      [Presence.Unavailable]: 'Busy',
      [Presence.Offline]: 'Away',
      [Presence.Dnd]: 'Do Not Disturb',
    }),
    []
  );

// Priority for group dominant presence: lower rank wins (most visible state).
// online > dnd > unavailable (busy) > offline (away)
const PRESENCE_RANK: Record<Presence, number> = {
  [Presence.Online]: 0,
  [Presence.Dnd]: 1,
  [Presence.Unavailable]: 2,
  [Presence.Offline]: 3,
};

/**
 * Derives the dominant presence across a group of users.
 *
 * Subscribes to presence events for all provided user IDs and returns the
 * most prominent state using the priority: online > dnd > unavailable > offline.
 * Returns undefined when userIds is empty or no presence data has arrived yet.
 */
export const useGroupPresence = (userIds: string[]): Presence | undefined => {
  const mx = useMatrixClient();
  // Join to a stable string so the effect only re-runs when the set of users changes.
  const userIdsKey = userIds.join('\n');

  const [presenceMap, setPresenceMap] = useState<Map<string, Presence>>(() => {
    const map = new Map<string, Presence>();
    for (const userId of userIds) {
      if (!userId) continue;
      const user = mx.getUser(userId);
      if (user) map.set(userId, getUserPresence(user).presence);
    }
    return map;
  });

  useEffect(() => {
    const ids = userIdsKey ? userIdsKey.split('\n').filter(Boolean) : [];

    if (ids.length === 0) {
      setPresenceMap((prev) => (prev.size > 0 ? new Map() : prev));
      return;
    }

    const initialMap = new Map<string, Presence>();
    const knownUsers: User[] = [];
    const unknownIds: string[] = [];

    for (const userId of ids) {
      const user = mx.getUser(userId);
      if (user) {
        initialMap.set(userId, getUserPresence(user).presence);
        knownUsers.push(user);
      } else {
        unknownIds.push(userId);
      }
    }
    setPresenceMap(initialMap);

    const handlePresenceUpdate: UserEventHandlerMap[UserEvent.Presence] = (_e, u) => {
      setPresenceMap((prev) => {
        const next = new Map(prev);
        next.set(u.userId, getUserPresence(u).presence);
        return next;
      });
    };

    for (const user of knownUsers) {
      user.on(UserEvent.Presence, handlePresenceUpdate);
      user.on(UserEvent.CurrentlyActive, handlePresenceUpdate);
      user.on(UserEvent.LastPresenceTs, handlePresenceUpdate);

      if (user.lastPresenceTs === 0) {
        mx.getPresence(user.userId)
          .then((status) => {
            user.presence = status.presence;
            user.presenceStatusMsg = status.status_msg;
            user.currentlyActive = status.currently_active ?? false;
            user.lastActiveAgo = status.last_active_ago ?? 0;
            user.lastPresenceTs = Date.now();
            setPresenceMap((prev) => {
              const next = new Map(prev);
              next.set(user.userId, getUserPresence(user).presence);
              return next;
            });
          })
          .catch(() => {});
      }
    }

    let handleClientEvent: ((event: MatrixEvent) => void) | undefined;
    if (unknownIds.length > 0) {
      handleClientEvent = (event: MatrixEvent) => {
        if (event.getType() !== 'm.presence') return;
        const sender = event.getSender() ?? (event.getContent().user_id as string | undefined);
        if (!sender || !unknownIds.includes(sender)) return;
        const latestUser = mx.getUser(sender);
        if (latestUser) {
          setPresenceMap((prev) => {
            const next = new Map(prev);
            next.set(sender, getUserPresence(latestUser).presence);
            return next;
          });
        }
      };
      mx.on(ClientEvent.Event, handleClientEvent);
    }

    return () => {
      for (const user of knownUsers) {
        user.removeListener(UserEvent.Presence, handlePresenceUpdate);
        user.removeListener(UserEvent.CurrentlyActive, handlePresenceUpdate);
        user.removeListener(UserEvent.LastPresenceTs, handlePresenceUpdate);
      }
      if (handleClientEvent) {
        mx.removeListener(ClientEvent.Event, handleClientEvent);
      }
    };
  }, [mx, userIdsKey]);

  if (presenceMap.size === 0) return undefined;

  let dominant: Presence = Presence.Offline;
  for (const p of presenceMap.values()) {
    if (PRESENCE_RANK[p] < PRESENCE_RANK[dominant]) {
      dominant = p;
      if (dominant === Presence.Online) break;
    }
  }
  return dominant;
};
