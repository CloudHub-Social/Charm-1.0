import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MatrixClient } from '$types/matrix-sdk';
import {
  getImmediateSyncRecoveryMetricAttributes,
  requestImmediateSyncRecovery,
} from './syncRecovery';

const mocks = vi.hoisted(() => ({
  getSlidingSyncManager: vi.fn<() => { retryNow: () => void } | undefined>(),
}));

vi.mock('$client/initMatrix', () => ({
  getSlidingSyncManager: mocks.getSlidingSyncManager,
}));

function makeMx(syncState: string | null = 'SYNCING'): MatrixClient & {
  retryImmediately: ReturnType<typeof vi.fn<() => boolean>>;
} {
  return {
    getSyncState: vi.fn<() => string | null>(() => syncState),
    retryImmediately: vi.fn<() => boolean>(() => true),
  } as unknown as MatrixClient & {
    retryImmediately: ReturnType<typeof vi.fn<() => boolean>>;
  };
}

describe('syncRecovery', () => {
  beforeEach(() => {
    mocks.getSlidingSyncManager.mockReset();
  });

  it('requests classic and sliding immediate retries when sliding sync is available', () => {
    const retryNow = vi.fn<() => void>();
    mocks.getSlidingSyncManager.mockReturnValue({ retryNow });
    const mx = makeMx('ERROR');

    const result = requestImmediateSyncRecovery(mx);

    expect(mx.retryImmediately).toHaveBeenCalledOnce();
    expect(retryNow).toHaveBeenCalledOnce();
    expect(result).toEqual({
      syncState: 'ERROR',
      classicRetried: true,
      hasSlidingSync: true,
    });
  });

  it('falls back to classic retry only when sliding sync is unavailable', () => {
    mocks.getSlidingSyncManager.mockReturnValue(undefined);
    const mx = makeMx(null);

    const result = requestImmediateSyncRecovery(mx);

    expect(mx.retryImmediately).toHaveBeenCalledOnce();
    expect(result).toEqual({
      syncState: null,
      classicRetried: true,
      hasSlidingSync: false,
    });
    expect(getImmediateSyncRecoveryMetricAttributes(result)).toEqual({
      sync_state: 'unknown',
      classic_retried: 'true',
      sliding_sync: 'false',
    });
  });
});
