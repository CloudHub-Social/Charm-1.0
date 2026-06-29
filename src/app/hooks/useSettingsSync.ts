import { useCallback, useEffect, useRef } from 'react';
import { atom, useAtom, useSetAtom } from 'jotai';
import type { MatrixEvent } from '$types/matrix-sdk';

import { useMatrixClient } from '$hooks/useMatrixClient';
import { useAccountDataCallback } from '$hooks/useAccountDataCallback';
import {
  persistExplicitlyClearedSettingsKeys,
  settingsAtom,
  settingsInitializedAtom,
  type Settings,
} from '$state/settings';
import {
  deserializeFromSync,
  getSettingsSyncUpdatedAt,
  getExplicitlyClearedSettingsKeysFromSync,
  serializeForSync,
} from '$utils/settingsSync';
import { CustomAccountDataEvent } from '$types/matrix/accountData';

export type SyncStatus = 'idle' | 'syncing' | 'error';

/** Milliseconds to wait after a local settings change before uploading. */
const DEBOUNCE_MS = 2000;
const LOCAL_SETTINGS_SYNC_UPDATED_AT_KEY = 'settings-sync-updated-at';

/** Unix timestamp (ms) of the last confirmed sync, or null if never synced this session. */
export const settingsSyncLastSyncedAtom = atom<number | null>(null);

/** Current upload state for UI feedback. */
export const settingsSyncStatusAtom = atom<SyncStatus>('idle');

const getLocalSettingsSyncUpdatedAtStorageKey = (userId: string | undefined): string =>
  userId ? `${LOCAL_SETTINGS_SYNC_UPDATED_AT_KEY}:${userId}` : LOCAL_SETTINGS_SYNC_UPDATED_AT_KEY;

const readLocalSettingsSyncUpdatedAt = (storageKey: string): number => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const persistLocalSettingsSyncUpdatedAt = (storageKey: string, updatedAt: number): void => {
  try {
    localStorage.setItem(storageKey, String(updatedAt));
  } catch {
    // Best-effort metadata write; settings themselves remain the source of truth.
  }
};

const getNextLocalSettingsSyncUpdatedAt = (previousUpdatedAt: number): number =>
  Math.max(Date.now(), previousUpdatedAt + 1);

const getSyncableSettingsJson = (settings: Settings): string =>
  JSON.stringify(serializeForSync(settings));

type SettingsSyncRuntime = {
  localUpdatedAt: number;
  applyingRemoteTimestamp: number | null;
  pendingEchoToken: string | null;
  previousSyncableSettingsJson: string;
};

const createSettingsSyncRuntime = (
  storageKey: string,
  settings: Settings
): SettingsSyncRuntime => ({
  localUpdatedAt: readLocalSettingsSyncUpdatedAt(storageKey),
  applyingRemoteTimestamp: null,
  pendingEchoToken: null,
  previousSyncableSettingsJson: getSyncableSettingsJson(settings),
});

const resetSettingsSyncRuntime = (
  runtime: SettingsSyncRuntime,
  storageKey: string,
  settings: Settings
): void => {
  runtime.localUpdatedAt = readLocalSettingsSyncUpdatedAt(storageKey);
  runtime.applyingRemoteTimestamp = null;
  runtime.pendingEchoToken = null;
  runtime.previousSyncableSettingsJson = getSyncableSettingsJson(settings);
};

const persistRuntimeLocalUpdatedAt = (
  runtime: SettingsSyncRuntime,
  storageKey: string,
  updatedAt: number
): void => {
  runtime.localUpdatedAt = updatedAt;
  persistLocalSettingsSyncUpdatedAt(storageKey, updatedAt);
};

const consumePendingRemoteApply = (runtime: SettingsSyncRuntime, storageKey: string): boolean => {
  if (runtime.applyingRemoteTimestamp === null) return false;

  persistRuntimeLocalUpdatedAt(runtime, storageKey, runtime.applyingRemoteTimestamp);
  runtime.applyingRemoteTimestamp = null;
  return true;
};

const isCurrentPendingUpload = (runtime: SettingsSyncRuntime, token: string): boolean =>
  runtime.pendingEchoToken === token;

const getFreshnessFloor = (runtime: SettingsSyncRuntime): number =>
  Math.max(runtime.localUpdatedAt, runtime.applyingRemoteTimestamp ?? 0);

const shouldApplyInitialRemote = (
  remoteUpdatedAt: number | null,
  localUpdatedAt: number
): boolean =>
  (remoteUpdatedAt === null && localUpdatedAt === 0) ||
  (remoteUpdatedAt !== null && remoteUpdatedAt >= localUpdatedAt);

const shouldIgnoreStaleRemoteUpdate = (
  remoteUpdatedAt: number | null,
  freshnessFloor: number
): boolean => remoteUpdatedAt !== null && freshnessFloor > 0 && remoteUpdatedAt < freshnessFloor;

const shouldPreferLegacyRemoteDuringUpload = (
  remoteContent: Record<string, unknown> | undefined,
  remoteUpdatedAt: number | null,
  localUpdatedAt: number
): boolean => !!remoteContent && remoteUpdatedAt === null && localUpdatedAt === 0;

const shouldPreferRemoteDuringUpload = (
  remoteContent: Record<string, unknown> | undefined,
  remoteUpdatedAt: number | null,
  localUpdatedAt: number
): boolean => !!remoteContent && remoteUpdatedAt !== null && remoteUpdatedAt >= localUpdatedAt;

/**
 * Side-effect hook that:
 *  - loads settings from account data when sync is first enabled
 *  - listens for live updates arriving from other devices
 *  - debounce-uploads local changes back to account data
 *
 * Only active when `settings.settingsSyncEnabled === true`.
 * Call this once from a component that stays mounted for the session lifetime.
 */
export function useSettingsSyncEffect(): void {
  const mx = useMatrixClient();
  const [settings, setSettings] = useAtom(settingsAtom);
  const setLastSynced = useSetAtom(settingsSyncLastSyncedAtom);
  const setSyncStatus = useSetAtom(settingsSyncStatusAtom);
  const setInitialized = useSetAtom(settingsInitializedAtom);

  // Keep a ref so callbacks can always read the latest value without stale closures.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const userId = typeof mx.getUserId === 'function' ? (mx.getUserId() ?? undefined) : undefined;
  const localUpdatedAtStorageKey = getLocalSettingsSyncUpdatedAtStorageKey(userId);

  const syncEnabled = settings.settingsSyncEnabled;
  const runtimeRef = useRef<SettingsSyncRuntime>(
    createSettingsSyncRuntime(localUpdatedAtStorageKey, settings)
  );

  useEffect(() => {
    resetSettingsSyncRuntime(runtimeRef.current, localUpdatedAtStorageKey, settingsRef.current);
  }, [localUpdatedAtStorageKey]);

  useEffect(() => {
    if (syncEnabled) return;

    const runtime = runtimeRef.current;
    runtime.pendingEchoToken = null;
    setSyncStatus('idle');
  }, [setSyncStatus, syncEnabled]);

  const applyRemoteContent = useCallback(
    (
      rawContent: Record<string, unknown>,
      options?: { markInitialized?: boolean }
    ): 'updated' | 'unchanged' | 'ignored' => {
      const { synctoken: _echoField, ...content } = rawContent;
      const remoteUpdatedAt = getSettingsSyncUpdatedAt(content);
      persistExplicitlyClearedSettingsKeys(getExplicitlyClearedSettingsKeysFromSync(content));
      const merged = deserializeFromSync(content, settingsRef.current);
      if (!merged) return 'ignored';

      const runtime = runtimeRef.current;
      if (JSON.stringify(merged) !== JSON.stringify(settingsRef.current)) {
        runtime.applyingRemoteTimestamp = remoteUpdatedAt ?? Date.now();
        setSettings(merged);
        setLastSynced(Date.now());
        if (options?.markInitialized) {
          setInitialized(true);
        }
        return 'updated';
      } else if (remoteUpdatedAt !== null) {
        persistRuntimeLocalUpdatedAt(runtime, localUpdatedAtStorageKey, remoteUpdatedAt);
      }

      setLastSynced(Date.now());
      return 'unchanged';
    },
    [localUpdatedAtStorageKey, setInitialized, setLastSynced, setSettings]
  );

  useEffect(() => {
    const runtime = runtimeRef.current;
    const currentSyncableSettingsJson = getSyncableSettingsJson(settings);
    if (currentSyncableSettingsJson === runtime.previousSyncableSettingsJson) return;

    runtime.previousSyncableSettingsJson = currentSyncableSettingsJson;
    if (!syncEnabled) return;

    if (consumePendingRemoteApply(runtime, localUpdatedAtStorageKey)) return;

    persistRuntimeLocalUpdatedAt(
      runtime,
      localUpdatedAtStorageKey,
      getNextLocalSettingsSyncUpdatedAt(runtime.localUpdatedAt)
    );
  }, [localUpdatedAtStorageKey, settings, syncEnabled]);

  // On mount / when sync is first enabled: load from account data
  // and mark settings initialized once the initial source of truth is known.
  useEffect(() => {
    if (!syncEnabled) {
      // If sync is disabled, settings are ready immediately
      setInitialized(true);
      return undefined;
    }

    const event = mx.getAccountData(CustomAccountDataEvent.SableSettings);
    if (!event) {
      // No account data exists — settings are ready immediately
      setInitialized(true);
      return undefined;
    }

    const rawContent = event.getContent() as Record<string, unknown>;
    const remoteUpdatedAt = getSettingsSyncUpdatedAt(rawContent);
    if (shouldApplyInitialRemote(remoteUpdatedAt, runtimeRef.current.localUpdatedAt)) {
      const applyResult = applyRemoteContent(rawContent, { markInitialized: true });
      if (applyResult === 'updated') {
        return undefined;
      }
    }

    setInitialized(true);
    return undefined;
  }, [applyRemoteContent, mx, syncEnabled, setInitialized]);

  // Live updates from other devices
  const onAccountData = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() !== (CustomAccountDataEvent.SableSettings as string)) return;
      if (!settingsRef.current.settingsSyncEnabled) return;

      const rawContent = event.getContent() as Record<string, unknown>;
      const runtime = runtimeRef.current;

      // If this is the echo of our own upload, just confirm success and skip.
      if (
        typeof rawContent.synctoken === 'string' &&
        rawContent.synctoken === runtime.pendingEchoToken
      ) {
        runtime.pendingEchoToken = null;
        const echoedUpdatedAt = getSettingsSyncUpdatedAt(rawContent);
        if (echoedUpdatedAt !== null && echoedUpdatedAt > runtime.localUpdatedAt) {
          persistRuntimeLocalUpdatedAt(runtime, localUpdatedAtStorageKey, echoedUpdatedAt);
        }
        setLastSynced(Date.now());
        setSyncStatus('idle');
        return;
      }

      const remoteUpdatedAt = getSettingsSyncUpdatedAt(rawContent);
      if (shouldIgnoreStaleRemoteUpdate(remoteUpdatedAt, getFreshnessFloor(runtime))) return;

      applyRemoteContent(rawContent);
    },
    [applyRemoteContent, localUpdatedAtStorageKey, setLastSynced, setSyncStatus]
  );
  useAccountDataCallback(mx, onAccountData);

  // Debounced upload whenever settings change
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!syncEnabled) return undefined;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const runtime = runtimeRef.current;
      const remoteEvent = mx.getAccountData(CustomAccountDataEvent.SableSettings);
      const remoteContent = remoteEvent?.getContent() as Record<string, unknown> | undefined;
      const remoteUpdatedAt = getSettingsSyncUpdatedAt(remoteContent);
      const hasLocalUpdatedAt = runtime.localUpdatedAt > 0;
      if (
        shouldPreferLegacyRemoteDuringUpload(
          remoteContent,
          remoteUpdatedAt,
          runtime.localUpdatedAt
        ) &&
        applyRemoteContent(remoteContent!) !== 'ignored'
      ) {
        setSyncStatus('idle');
        return;
      }

      let localUpdatedAt = hasLocalUpdatedAt
        ? runtime.localUpdatedAt
        : getNextLocalSettingsSyncUpdatedAt(runtime.localUpdatedAt);
      if (!hasLocalUpdatedAt) {
        persistRuntimeLocalUpdatedAt(runtime, localUpdatedAtStorageKey, localUpdatedAt);
      }

      if (
        shouldPreferRemoteDuringUpload(remoteContent, remoteUpdatedAt, localUpdatedAt) &&
        applyRemoteContent(remoteContent!) !== 'ignored'
      ) {
        setSyncStatus('idle');
        return;
      }

      if (remoteUpdatedAt !== null && remoteUpdatedAt > localUpdatedAt) {
        localUpdatedAt = remoteUpdatedAt;
        persistRuntimeLocalUpdatedAt(runtime, localUpdatedAtStorageKey, remoteUpdatedAt);
      }

      setSyncStatus('syncing');
      const token = Math.random().toString(36).slice(2, 10);
      runtime.pendingEchoToken = token;
      const content = {
        ...serializeForSync(settingsRef.current, localUpdatedAt),
        synctoken: token,
      };
      mx.setAccountData(
        CustomAccountDataEvent.SableSettings,
        content as Record<string, unknown>
      ).catch(() => {
        if (!isCurrentPendingUpload(runtime, token)) return;

        runtime.pendingEchoToken = null;
        setSyncStatus('error');
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [applyRemoteContent, localUpdatedAtStorageKey, mx, settings, syncEnabled, setSyncStatus]);
}
