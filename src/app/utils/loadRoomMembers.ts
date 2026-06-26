import type { Room } from '$types/matrix-sdk';
import { ConcurrencyQueue } from './concurrencyQueue';

// Background preloads (e.g. room-list avatars) share this queue to cap concurrent /members requests.
const memberQueue = new ConcurrencyQueue(3);
const loadedRoomIds = new Set<string>();
const inflightPromises = new Map<string, Promise<void>>();

/**
 * Load room members at most once per room.
 *
 * Pass `{ foreground: true }` for user-visible loads (active room, member panel,
 * mention autocomplete) — these bypass the concurrency queue so a large backlog
 * of background avatar preloads cannot delay them.
 *
 * Safe to call from multiple hooks simultaneously: duplicate calls for the same
 * room share a single in-flight promise, and completed rooms are never re-fetched.
 */
export async function loadRoomMembersOnce(
  room: Room,
  options?: { foreground?: boolean }
): Promise<void> {
  const { roomId } = room;
  if (loadedRoomIds.has(roomId)) return;

  let promise = inflightPromises.get(roomId);
  if (!promise) {
    const load = () =>
      room
        .loadMembersIfNeeded()
        .then(() => {
          loadedRoomIds.add(roomId);
        })
        .finally(() => {
          inflightPromises.delete(roomId);
        });

    promise = options?.foreground ? load() : memberQueue.add(load);
    inflightPromises.set(roomId, promise);
  }

  await promise;
}

export function isRoomMembersLoaded(roomId: string): boolean {
  return loadedRoomIds.has(roomId);
}

export function markRoomMembersLoaded(roomId: string): void {
  loadedRoomIds.add(roomId);
}
