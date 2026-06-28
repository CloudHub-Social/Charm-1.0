import { useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import * as Sentry from '@sentry/react';
import type { MatrixEvent, MatrixClient } from '$types/matrix-sdk';
import { SetPresence, MatrixError } from '$types/matrix-sdk';
import { useMatrixClient } from '$hooks/useMatrixClient';
import { useAccountDataCallback } from '$hooks/useAccountDataCallback';
import { settingsAtom, presenceAutoIdledAtom } from '$state/settings';
import { CustomAccountDataEvent } from '$types/matrix/accountData';
import { getSlidingSyncManager } from '$client/initMatrix';
import { createDebugLogger } from '$utils/debugLogger';

const debugLog = createDebugLogger('PresenceSync');

/** Milliseconds to wait after a local presence change before uploading. */
const DEBOUNCE_MS = 25000; // 25 seconds

/** Fast debounce for activity events (idle→online) to ensure rapid multi-device sync. */
const ACTIVITY_DEBOUNCE_MS = 500; // 500ms

/** Minimum time between presence updates to avoid rate limiting. */
const THROTTLE_MS = 25000; // 25 seconds
const LOCAL_PRESENCE_SYNC_UPDATED_AT_KEY = 'presence-sync-updated-at';

/** Sleep utility for rate limit backoff. */
const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Timestamp (ms) of the last successful presence send. */
let lastSentTimestamp = 0;

/** @internal Test-only reset for module-level presence throttling state. */
export const resetPresenceSyncThrottleForTests = (): void => {
  lastSentTimestamp = 0;
};

/** @internal Test-only setter for module-level presence throttling state. */
export const setPresenceSyncThrottleTimestampForTests = (timestamp: number): void => {
  lastSentTimestamp = timestamp;
};

type PresenceState = {
  /** The selected presence mode: 'online' | 'unavailable' | 'dnd' | 'offline' */
  presenceMode: 'online' | 'unavailable' | 'dnd' | 'offline';
  /** Whether auto-idle has been triggered locally. */
  autoIdled: boolean;
  /** Unix timestamp (ms) of when this state was last updated. */
  updatedAt: number;
  /** Unix timestamp (ms) of the most recent user activity across all devices. */
  lastActivityAt: number;
};

const getLocalPresenceSyncUpdatedAtStorageKey = (userId: string | undefined): string =>
  userId ? `${LOCAL_PRESENCE_SYNC_UPDATED_AT_KEY}:${userId}` : LOCAL_PRESENCE_SYNC_UPDATED_AT_KEY;

const readLocalPresenceSyncUpdatedAt = (storageKey: string): number => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const persistLocalPresenceSyncUpdatedAt = (storageKey: string, updatedAt: number): void => {
  try {
    localStorage.setItem(storageKey, String(updatedAt));
  } catch {
    // Best-effort metadata write; account data remains the source of truth.
  }
};

const getNextLocalPresenceSyncUpdatedAt = (previousUpdatedAt: number): number =>
  Math.max(Date.now(), previousUpdatedAt + 1);

const getPresenceSyncUpdatedAt = (
  content: Partial<PresenceState> | Record<string, unknown> | undefined
): number | null => {
  const updatedAt = content?.updatedAt;
  return typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : null;
};

const serializePresenceForSyncComparison = (
  presenceMode: PresenceState['presenceMode'],
  autoIdled: boolean
) => JSON.stringify({ presenceMode, autoIdled });

/**
 * Side-effect hook that syncs presence state across devices via account data.
 *
 * Presence doesn't echo back from the server on MSC4186, so we manually
 * propagate manual presence changes AND auto-idle state to other devices
 * using account data (similar to settings sync).
 *
 * Multi-device auto-idle coordination:
 * - ONLINE TAKES PRECEDENCE: When ANY device becomes active, ALL devices
 *   immediately switch to online. Activity events use a 2-second debounce
 *   for rapid synchronization.
 * - Idle events use a 25-second debounce to reduce server load and avoid
 *   rate limiting.
 * - Tracks `lastActivityAt` timestamp to coordinate activity across devices.
 * - Dispatches 'sable:remote-activity' custom event when another device
 *   becomes active, which resets the local idle timer in usePresenceAutoIdle.
 *
 * When another device changes presence or goes idle, this hook receives
 * the account data update and applies it locally.
 *
 * Only active when `settings.sendPresence === true`.
 */
export function usePresenceSyncEffect(): void {
  const mx = useMatrixClient();
  const [settings, setSettings] = useAtom(settingsAtom);
  const [autoIdled, setAutoIdled] = useAtom(presenceAutoIdledAtom);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const autoIdledRef = useRef(autoIdled);
  autoIdledRef.current = autoIdled;

  const syncEnabled = settings.sendPresence;
  const presenceMode = settings.presenceMode ?? 'online';
  const userId = typeof mx.getUserId === 'function' ? (mx.getUserId() ?? undefined) : undefined;
  const localUpdatedAtStorageKey = getLocalPresenceSyncUpdatedAtStorageKey(userId);

  // Echo-detection: track the token of our last upload
  const pendingEchoTokenRef = useRef<string | null>(null);

  // Track last-known remote state to avoid unnecessary updates
  const lastRemoteStateRef = useRef<PresenceState | null>(null);
  const localUpdatedAtRef = useRef<number>(
    readLocalPresenceSyncUpdatedAt(localUpdatedAtStorageKey)
  );
  const applyingRemoteTimestampRef = useRef<number | null>(null);
  const previousSyncablePresenceJsonRef = useRef(
    serializePresenceForSyncComparison(presenceMode, autoIdled)
  );

  const getFreshnessFloor = useCallback(
    (): number => Math.max(localUpdatedAtRef.current, applyingRemoteTimestampRef.current ?? 0),
    []
  );
  const persistRemoteFreshness = useCallback(
    (updatedAt: number): void => {
      localUpdatedAtRef.current = updatedAt;
      persistLocalPresenceSyncUpdatedAt(localUpdatedAtStorageKey, updatedAt);
    },
    [localUpdatedAtStorageKey]
  );

  useEffect(() => {
    localUpdatedAtRef.current = readLocalPresenceSyncUpdatedAt(localUpdatedAtStorageKey);
    applyingRemoteTimestampRef.current = null;
    pendingEchoTokenRef.current = null;
    lastRemoteStateRef.current = null;
    previousSyncablePresenceJsonRef.current = serializePresenceForSyncComparison(
      settingsRef.current.presenceMode ?? 'online',
      autoIdledRef.current
    );
  }, [localUpdatedAtStorageKey]);

  useEffect(() => {
    const currentSyncablePresenceJson = serializePresenceForSyncComparison(presenceMode, autoIdled);
    if (currentSyncablePresenceJson === previousSyncablePresenceJsonRef.current) return;

    previousSyncablePresenceJsonRef.current = currentSyncablePresenceJson;

    if (!syncEnabled) return;

    const appliedRemoteTimestamp = applyingRemoteTimestampRef.current;
    if (appliedRemoteTimestamp !== null) {
      persistRemoteFreshness(appliedRemoteTimestamp);
      applyingRemoteTimestampRef.current = null;
      return;
    }

    const updatedAt = getNextLocalPresenceSyncUpdatedAt(localUpdatedAtRef.current);
    persistRemoteFreshness(updatedAt);
  }, [autoIdled, persistRemoteFreshness, presenceMode, syncEnabled]);

  const applyRemoteContent = useCallback(
    (
      rawContent: Partial<PresenceState> & { synctoken?: string }
    ): 'updated' | 'unchanged' | 'ignored' => {
      const { synctoken: _echoField, ...state } = rawContent;
      if (!state.presenceMode || typeof state.autoIdled !== 'boolean') return 'ignored';

      const remoteUpdatedAt = getPresenceSyncUpdatedAt(state);
      const normalizedState: PresenceState = {
        presenceMode: state.presenceMode,
        autoIdled: state.autoIdled,
        updatedAt: remoteUpdatedAt ?? Date.now(),
        lastActivityAt:
          typeof state.lastActivityAt === 'number' && Number.isFinite(state.lastActivityAt)
            ? state.lastActivityAt
            : (remoteUpdatedAt ?? Date.now()),
      };

      lastRemoteStateRef.current = normalizedState;

      const localNeedsUpdate =
        normalizedState.presenceMode !== settingsRef.current.presenceMode ||
        normalizedState.autoIdled !== autoIdledRef.current;

      if (!localNeedsUpdate) {
        if (remoteUpdatedAt !== null) {
          persistRemoteFreshness(remoteUpdatedAt);
        }
        return 'unchanged';
      }

      applyingRemoteTimestampRef.current = remoteUpdatedAt ?? Date.now();
      debugLog.info('general', 'Applying presence from account data', { state: normalizedState });
      if (normalizedState.presenceMode !== settingsRef.current.presenceMode) {
        setSettings({ ...settingsRef.current, presenceMode: normalizedState.presenceMode });
      }
      if (normalizedState.autoIdled !== autoIdledRef.current) {
        setAutoIdled(normalizedState.autoIdled);
      }
      return 'updated';
    },
    [persistRemoteFreshness, setAutoIdled, setSettings]
  );

  // On mount / when sync is first enabled: load from account data
  useEffect(() => {
    if (!syncEnabled) {
      pendingEchoTokenRef.current = null;
      applyingRemoteTimestampRef.current = null;
      lastRemoteStateRef.current = null;
      return undefined;
    }
    const event = mx.getAccountData(CustomAccountDataEvent.SablePresence);
    if (!event) return undefined;

    const rawContent = event.getContent<PresenceState & { synctoken?: string }>();
    const remoteUpdatedAt = getPresenceSyncUpdatedAt(rawContent);
    if (
      (remoteUpdatedAt === null && localUpdatedAtRef.current === 0) ||
      (remoteUpdatedAt !== null && remoteUpdatedAt >= localUpdatedAtRef.current)
    ) {
      applyRemoteContent(rawContent);
    }
    return undefined;
  }, [applyRemoteContent, mx, syncEnabled]);

  // Live updates from other devices
  const onAccountData = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() !== (CustomAccountDataEvent.SablePresence as string)) return;
      if (!settingsRef.current.sendPresence) return;

      const rawContent = event.getContent<PresenceState & { synctoken?: string }>();

      // If this is the echo of our own upload, skip.
      if (
        typeof rawContent.synctoken === 'string' &&
        rawContent.synctoken === pendingEchoTokenRef.current
      ) {
        pendingEchoTokenRef.current = null;
        const echoedUpdatedAt = getPresenceSyncUpdatedAt(rawContent);
        if (echoedUpdatedAt !== null && echoedUpdatedAt > localUpdatedAtRef.current) {
          persistRemoteFreshness(echoedUpdatedAt);
        }
        debugLog.info('general', 'Received echo of our own presence upload', {
          mode: rawContent.presenceMode,
          autoIdled: rawContent.autoIdled,
        });
        return;
      }

      const { synctoken: _echoField, ...state } = rawContent;
      const remoteUpdatedAt = getPresenceSyncUpdatedAt(rawContent);
      if (
        state.presenceMode &&
        typeof state.autoIdled === 'boolean' &&
        lastRemoteStateRef.current &&
        lastRemoteStateRef.current.presenceMode === state.presenceMode &&
        lastRemoteStateRef.current.autoIdled === state.autoIdled &&
        lastRemoteStateRef.current.lastActivityAt === state.lastActivityAt
      ) {
        if (remoteUpdatedAt !== null) {
          persistRemoteFreshness(remoteUpdatedAt);
          lastRemoteStateRef.current = {
            ...lastRemoteStateRef.current,
            updatedAt: remoteUpdatedAt,
          };
        }
        return;
      }

      const freshnessFloor = getFreshnessFloor();
      if (remoteUpdatedAt !== null && freshnessFloor > 0 && remoteUpdatedAt < freshnessFloor) {
        debugLog.info('general', 'Ignoring stale presence account data update', {
          remoteUpdatedAt,
          freshnessFloor,
        });
        Sentry.addBreadcrumb({
          category: 'presence-sync',
          message: 'Ignored stale remote presence state',
          level: 'info',
          data: { remoteUpdatedAt, freshnessFloor },
        });
        return;
      }

      if (!state.presenceMode || typeof state.autoIdled !== 'boolean') return;

      // Apply state from another device
      debugLog.info('general', 'Received presence update from another device', { state });

      // ONLINE TAKES PRECEDENCE: If remote device is active (not auto-idled),
      // immediately clear local auto-idle state. This ensures that when ANY device
      // becomes active, ALL devices switch to online.
      if (!state.autoIdled && autoIdledRef.current) {
        debugLog.info('general', 'Remote device is active — clearing local auto-idle');
        setAutoIdled(false);
        // Trigger activity event in auto-idle hook to reset its timer
        window.dispatchEvent(
          new CustomEvent('sable:remote-activity', { detail: { timestamp: state.lastActivityAt } })
        );
      }

      // DON'T apply remote idle state if we're currently active locally.
      // This prevents race conditions where remote idle updates overwrite local activity
      // during the debounce window before our activity uploads to account data.
      if (state.autoIdled && !autoIdledRef.current) {
        debugLog.info('general', 'Ignoring remote idle state — we are active locally');
        applyRemoteContent({ ...rawContent, autoIdled: false });
        return;
      } else if (state.autoIdled !== autoIdledRef.current) {
        setAutoIdled(state.autoIdled);
      }

      applyRemoteContent(rawContent);

      // DO NOT send to server here — the remote device already sent it.
      // Sending again causes redundant traffic and can trigger rate limiting,
      // preventing our local state changes from being sent when they should be.
    },
    [applyRemoteContent, getFreshnessFloor, persistRemoteFreshness, setAutoIdled]
  );
  useAccountDataCallback(mx, onAccountData);

  // Debounced upload whenever presence or auto-idle changes
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!syncEnabled) return undefined;

    clearTimeout(timerRef.current);

    // Use fast debounce for activity events (idle→online) to ensure rapid multi-device sync.
    // Use longer debounce for idle events to avoid rate limiting.
    const wasIdled = lastRemoteStateRef.current?.autoIdled ?? false;
    const isActivityEvent = wasIdled && !autoIdled;
    const debounceMs = isActivityEvent ? ACTIVITY_DEBOUNCE_MS : DEBOUNCE_MS;

    timerRef.current = setTimeout(() => {
      const sendServerPresence = () => {
        void sendPresenceToServer(
          mx,
          presenceMode,
          autoIdled,
          settings.presenceStatusMsg,
          syncEnabled
        );
      };
      const remoteEvent = mx.getAccountData(CustomAccountDataEvent.SablePresence);
      const remoteContent = remoteEvent?.getContent() as
        | (Partial<PresenceState> & { synctoken?: string })
        | undefined;
      const remoteUpdatedAt = getPresenceSyncUpdatedAt(remoteContent);
      const hasLocalUpdatedAt = localUpdatedAtRef.current > 0;
      if (remoteContent && remoteUpdatedAt === null && !hasLocalUpdatedAt) {
        const applyResult = applyRemoteContent(remoteContent);
        if (applyResult !== 'ignored') {
          if (applyResult !== 'updated') sendServerPresence();
          return;
        }
      }

      let localUpdatedAt = hasLocalUpdatedAt
        ? localUpdatedAtRef.current
        : getNextLocalPresenceSyncUpdatedAt(localUpdatedAtRef.current);
      if (!hasLocalUpdatedAt) {
        persistRemoteFreshness(localUpdatedAt);
      }

      if (
        remoteContent &&
        remoteUpdatedAt !== null &&
        remoteUpdatedAt >= localUpdatedAt
      ) {
        const applyResult = applyRemoteContent(remoteContent);
        if (applyResult !== 'ignored') {
          if (applyResult !== 'updated') sendServerPresence();
          return;
        }
      }

      if (remoteUpdatedAt !== null && remoteUpdatedAt > localUpdatedAt) {
        localUpdatedAt = remoteUpdatedAt;
        persistRemoteFreshness(remoteUpdatedAt);
      }

      const token = Math.random().toString(36).slice(2, 10);
      pendingEchoTokenRef.current = token;

      const now = Date.now();
      // When going from idle to active, update lastActivityAt
      // When going idle, preserve the existing lastActivityAt from remote state
      const lastActivityAt =
        !autoIdled && lastRemoteStateRef.current?.lastActivityAt
          ? Math.max(now, lastRemoteStateRef.current.lastActivityAt)
          : (lastRemoteStateRef.current?.lastActivityAt ?? now);

      const state: PresenceState & { synctoken: string } = {
        presenceMode,
        autoIdled,
        updatedAt: localUpdatedAt,
        lastActivityAt,
        synctoken: token,
      };

      debugLog.info('general', 'Uploading presence to account data', {
        state,
        isActivityEvent,
        debounceMs,
      });

      mx.setAccountData(CustomAccountDataEvent.SablePresence, state as Record<string, unknown>)
        .then(() => {
          lastRemoteStateRef.current = {
            presenceMode,
            autoIdled,
            updatedAt: localUpdatedAt,
            lastActivityAt: state.lastActivityAt,
          };
        })
        .catch((err) => {
          pendingEchoTokenRef.current = null;
          debugLog.error('general', 'Failed to upload presence to account data', {
            error: err instanceof Error ? err.message : String(err),
          });
        });

      sendServerPresence();
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
  }, [
    applyRemoteContent,
    autoIdled,
    mx,
    persistRemoteFreshness,
    presenceMode,
    settings.presenceStatusMsg,
    syncEnabled,
  ]);
}

/**
 * Send presence state to the Matrix server.
 * For auto-idle, sends 'unavailable'. For DND, sends 'online' with status_msg='[dnd]'
 * so other Sable clients can decode and display the DND badge.
 *
 * Throttles to at most once per THROTTLE_MS to avoid rate limiting.
 * If rate limited (429), respects Retry-After header and backs off.
 */
async function sendPresenceToServer(
  mx: MatrixClient,
  presenceMode: 'online' | 'unavailable' | 'dnd' | 'offline',
  autoIdled: boolean,
  customStatusMsg: string,
  syncEnabled: boolean
): Promise<void> {
  if (!syncEnabled) return;

  // Determine effective presence to send to server
  let serverPresence: 'online' | 'unavailable' | 'offline' = 'online';
  let statusMsg: string | undefined;

  if (autoIdled) {
    serverPresence = 'unavailable';
    // Preserve custom status when auto-idled
    statusMsg = customStatusMsg || undefined;
  } else if (presenceMode === 'dnd') {
    // DND is encoded as online + status_msg starting with '[dnd]' so:
    // - Other Sable clients decode it and show the DND badge (red color)
    // - Non-Sable clients see the [dnd] prefix and custom status
    // - Sable strips the [dnd] prefix when displaying status text
    serverPresence = 'online';
    statusMsg = customStatusMsg ? `[dnd] ${customStatusMsg}` : '[dnd]';
  } else if (presenceMode === 'offline') {
    serverPresence = 'offline';
    statusMsg = customStatusMsg || undefined;
  } else if (presenceMode === 'unavailable') {
    serverPresence = 'unavailable';
    statusMsg = customStatusMsg || undefined;
  } else {
    // online
    serverPresence = 'online';
    statusMsg = customStatusMsg || undefined;
  }

  debugLog.info('general', 'Sending presence to server', {
    mode: presenceMode,
    autoIdled,
    serverPresence,
    statusMsg,
  });

  // Keep classic and sliding sync presence configuration aligned with the
  // effective presence even if the immediate network request fails or backs off.
  mx.setSyncPresence(serverPresence === 'offline' ? SetPresence.Offline : undefined);
  getSlidingSyncManager(mx)?.setPresenceEnabled(serverPresence !== 'offline');

  // Throttle: don't send more frequently than THROTTLE_MS
  const now = Date.now();
  const timeSinceLastSent = now - lastSentTimestamp;
  if (timeSinceLastSent < THROTTLE_MS) {
    debugLog.info('general', 'Skipping presence update (throttled)', {
      timeSinceLastSent,
      throttleMs: THROTTLE_MS,
    });
    return;
  }

  // Send via matrix-js-sdk with 429 handling and retry
  let retryCount = 0;
  const maxRetries = 3;

  // eslint-disable-next-line no-await-in-loop -- Sequential retries are intentional
  while (retryCount <= maxRetries) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Presence retries must remain sequential to preserve backoff behavior.
      await mx.setPresence({ presence: serverPresence, status_msg: statusMsg });
      lastSentTimestamp = Date.now();
      return; // Success - exit
    } catch (err) {
      if (err instanceof MatrixError && err.httpStatus === 429) {
        // Rate limited - respect Retry-After and retry after backoff
        const retryAfterMs = err.data?.retry_after_ms ?? 5000;
        debugLog.warn('general', 'Presence rate limited (429), backing off', {
          retryAfterMs,
          retryCount,
        });

        Sentry.captureMessage('Presence rate limited', {
          level: 'warning',
          tags: { component: 'presence-sync' },
          extra: { retryAfterMs, userId: mx.getUserId(), retryCount },
        });

        // If we've exhausted retries, give up
        if (retryCount >= maxRetries) {
          debugLog.error('general', 'Presence retry limit exceeded after 429', { maxRetries });
          lastSentTimestamp = Date.now();
          return;
        }

        // Wait before retrying
        // eslint-disable-next-line no-await-in-loop -- Retry-After must block the next sequential attempt.
        await sleep(retryAfterMs);
        lastSentTimestamp = Date.now();
        retryCount += 1;
        continue; // Retry the request
      }
      // Non-429 error - log and exit
      debugLog.error('general', 'Failed to send presence to server', {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }
}
