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

  if (options?.foreground) {
    // Foreground calls bypass the queue. If a background promise is already
    // cached (waiting for a queue slot), we still fire loadMembersIfNeeded()
    // directly — the SDK deduplicates concurrent network calls — and replace
    // the cached promise so any other waiters also get the faster path.
    // The displaced background callback will run when it gets a slot but
    // loadMembersIfNeeded() will be a cheap no-op by then.
    const p: Promise<void> = room
      .loadMembersIfNeeded()
      .then(() => { loadedRoomIds.add(roomId); })
      .finally(() => { if (inflightPromises.get(roomId) === p) inflightPromises.delete(roomId); });
    inflightPromises.set(roomId, p);
    await p;
    return;
  }

  // Background path: only enqueue if nothing is already inflight for this room.
  if (!inflightPromises.has(roomId)) {
    const p: Promise<void> = memberQueue
      .add(() => room.loadMembersIfNeeded())
      .then(() => { loadedRoomIds.add(roomId); })
      .finally(() => { if (inflightPromises.get(roomId) === p) inflightPromises.delete(roomId); });
    inflightPromises.set(roomId, p);
  }
  await inflightPromises.get(roomId)!;
}

export function isRoomMembersLoaded(roomId: string): boolean {
  return loadedRoomIds.has(roomId);
}

export function markRoomMembersLoaded(roomId: string): void {
  loadedRoomIds.add(roomId);
}
