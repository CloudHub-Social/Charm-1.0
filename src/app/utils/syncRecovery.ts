import type { MatrixClient } from '$types/matrix-sdk';
import { getSlidingSyncManager } from '$client/initMatrix';

export type ImmediateSyncRecoveryResult = {
  syncState: ReturnType<MatrixClient['getSyncState']>;
  classicRetried: boolean;
  hasSlidingSync: boolean;
};

export const requestImmediateSyncRecovery = (mx: MatrixClient): ImmediateSyncRecoveryResult => {
  const syncState = mx.getSyncState();
  const classicRetried = mx.retryImmediately();
  const slidingSyncManager = getSlidingSyncManager(mx);
  slidingSyncManager?.retryNow();

  return {
    syncState,
    classicRetried,
    hasSlidingSync: !!slidingSyncManager,
  };
};

export const getImmediateSyncRecoveryMetricAttributes = (
  result: ImmediateSyncRecoveryResult
): Record<string, string> => ({
  sync_state: result.syncState ?? 'unknown',
  classic_retried: String(result.classicRetried),
  sliding_sync: String(result.hasSlidingSync),
});
