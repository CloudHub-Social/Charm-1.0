import { reloadWithTelemetry } from '$utils/reloadWithTelemetry';

const STORE_DEGRADED_RECOVERY_REASON = 'sync_store_degraded_recovery';
const STORE_DEGRADED_RECOVERY_THROTTLE_MS = 60_000;
const STORE_DEGRADED_RECOVERY_AT_KEY = 'sable_sync_store_degraded_recovery_at';
const noop = (): void => undefined;
let pendingStoreDegradedRecovery = false;

export const resetStoreDegradedRecoveryForTests = (): void => {
  pendingStoreDegradedRecovery = false;
};

const recentlyRequestedStoreDegradedRecovery = (): boolean => {
  try {
    const requestedAt = Number.parseInt(
      window.sessionStorage.getItem(STORE_DEGRADED_RECOVERY_AT_KEY) ?? '',
      10
    );
    return (
      Number.isFinite(requestedAt) && Date.now() - requestedAt < STORE_DEGRADED_RECOVERY_THROTTLE_MS
    );
  } catch {
    return false;
  }
};

const markStoreDegradedRecoveryRequested = (): void => {
  try {
    window.sessionStorage.setItem(STORE_DEGRADED_RECOVERY_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
};

export const requestStoreDegradedRecoveryReload = (data?: Record<string, unknown>): boolean => {
  if (pendingStoreDegradedRecovery || recentlyRequestedStoreDegradedRecovery()) {
    return false;
  }

  pendingStoreDegradedRecovery = true;
  markStoreDegradedRecoveryRequested();
  let settled = false;
  let cleanup = noop;

  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
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
