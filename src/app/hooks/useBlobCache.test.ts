import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBlobCacheFailures,
  getBlobCacheBlockedReason,
  recordBlobCacheFailure,
  setBlobCacheSession,
} from './useBlobCache';

describe('useBlobCache failure recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'));
    clearBlobCacheFailures();
    setBlobCacheSession(undefined, undefined);
  });

  it('retries transient auth failures after the cooldown window', () => {
    recordBlobCacheFailure('auth:key', 'auth');

    expect(getBlobCacheBlockedReason('auth:key')).toBe('auth');

    vi.advanceTimersByTime(15_001);

    expect(getBlobCacheBlockedReason('auth:key')).toBeUndefined();
  });

  it('clears blocked media failures when the active session changes', () => {
    recordBlobCacheFailure('auth:key', 'auth');

    setBlobCacheSession('token-a', 'https://hs-a.example');
    expect(getBlobCacheBlockedReason('auth:key')).toBeUndefined();

    recordBlobCacheFailure('auth:key', 'auth');
    setBlobCacheSession('token-b', 'https://hs-a.example');
    expect(getBlobCacheBlockedReason('auth:key')).toBeUndefined();
  });

  it('keeps bad-request failures blocked longer than transient auth failures', () => {
    recordBlobCacheFailure('bad:key', 'bad_request');

    vi.advanceTimersByTime(15_001);
    expect(getBlobCacheBlockedReason('bad:key')).toBe('bad_request');

    vi.advanceTimersByTime(5 * 60_000);
    expect(getBlobCacheBlockedReason('bad:key')).toBeUndefined();
  });
});
