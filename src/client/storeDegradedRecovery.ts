import { reloadWithTelemetry } from '$utils/reloadWithTelemetry';

const STORE_DEGRADED_RECOVERY_REASON = 'sync_store_degraded_recovery';
const STORE_DEGRADED_RECOVERY_THROTTLE_MS = 60_000;
const STORE_DEGRADED_RECOVERY_AT_KEY = 'sable_sync_store_degraded_recovery_at';
const noop = (): void => undefined;
let pendingStoreDegradedRecovery = false;
type StoreDegradedRecoveryMarkerState = 'pending' | 'reloading';

const parseStoreDegradedRecoveryMarker = (
  value: string | null
): { state: StoreDegradedRecoveryMarkerState; requestedAt: number } | undefined => {
  if (!value) return undefined;

  const [state, requestedAtRaw] = value.split(':');
  if (state !== 'pending' && state !== 'reloading') return undefined;

  const requestedAt = Number.parseInt(requestedAtRaw ?? '', 10);
  if (!Number.isFinite(requestedAt)) return undefined;

  return { state, requestedAt };
};

export const resetStoreDegradedRecoveryForTests = (): void => {
  pendingStoreDegradedRecovery = false;
};

export const clearStoreDegradedRecoveryThrottle = (): void => {
  pendingStoreDegradedRecovery = false;
  try {
    window.sessionStorage.removeItem(STORE_DEGRADED_RECOVERY_AT_KEY);
  } catch {
    // ignore
  }
};

const recentlyRequestedStoreDegradedRecovery = (): boolean => {
  try {
    const marker = parseStoreDegradedRecoveryMarker(
      window.sessionStorage.getItem(STORE_DEGRADED_RECOVERY_AT_KEY)
    );
    if (!marker) return false;
    if (marker.state === 'pending') return true;
    return Date.now() - marker.requestedAt < STORE_DEGRADED_RECOVERY_THROTTLE_MS;
  } catch {
    return false;
  }
};

const markStoreDegradedRecoveryRequested = (state: StoreDegradedRecoveryMarkerState): boolean => {
  try {
    window.sessionStorage.setItem(STORE_DEGRADED_RECOVERY_AT_KEY, `${state}:${Date.now()}`);
    return true;
  } catch {
    return false;
  }
};

export const requestStoreDegradedRecoveryReload = (data?: Record<string, unknown>): boolean => {
  if (pendingStoreDegradedRecovery || recentlyRequestedStoreDegradedRecovery()) {
    return false;
  }

  pendingStoreDegradedRecovery = true;
  if (!markStoreDegradedRecoveryRequested('pending')) {
    pendingStoreDegradedRecovery = false;
    return false;
  }
  let settled = false;
  let cleanup = noop;

  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    if (!markStoreDegradedRecoveryRequested('reloading')) {
      pendingStoreDegradedRecovery = false;
      return;
    }
    reloadWithTelemetry(STORE_DEGRADED_RECOVERY_REASON, data);
  };

  if (document.visibilityState === 'visible') {
    window.setTimeout(finish, 0);
    return true;
  }

  const handleVisible = () => {
    if (document.visibilityState === 'visible') {
      finish();
    }
  };

  cleanup = () => {
    document.removeEventListener('visibilitychange', handleVisible);
    window.removeEventListener('pageshow', handleVisible);
    window.removeEventListener('focus', handleVisible);
  };

  document.addEventListener('visibilitychange', handleVisible);
  window.addEventListener('pageshow', handleVisible);
  window.addEventListener('focus', handleVisible);
  return true;
};
