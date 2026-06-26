import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRecentServiceWorkerControllerChange,
  classifyCryptoStoreIndexedDbError,
  getCryptoStoreRecoveryAction,
  hasRecentServiceWorkerControllerChange,
  isCryptoStoreIndexedDbError,
  markRecentServiceWorkerControllerChange,
  resetCryptoStoreRecoveryReloadCount,
} from './cryptoStoreErrors';

const SW_CONTROLLER_CHANGED_AT_KEY = '__swControllerChangedAt';

afterEach(() => {
  clearRecentServiceWorkerControllerChange();
  resetCryptoStoreRecoveryReloadCount();
});

describe('crypto store IndexedDB error classification', () => {
  it('classifies Safari IndexedDB transaction aborts from rust crypto logs', () => {
    const message =
      'failed to read or write to the crypto store DomException Error (0): Transaction aborted';

    expect(classifyCryptoStoreIndexedDbError(message)).toBe('transaction_aborted');
    expect(isCryptoStoreIndexedDbError(message)).toBe(true);
  });

  it('classifies rust crypto backend transaction aborts', () => {
    const message =
      'Backend(DomException { code: 0, name: "Error", message: "Transaction aborted" })';

    expect(classifyCryptoStoreIndexedDbError(message)).toBe('transaction_aborted');
    expect(isCryptoStoreIndexedDbError(message)).toBe(true);
  });

  it('classifies pre-existing IndexedDB transaction errors', () => {
    expect(classifyCryptoStoreIndexedDbError('without an in-progress transaction')).toBe(
      'transaction_error'
    );
    expect(classifyCryptoStoreIndexedDbError('database connection is closed')).toBe(
      'connection_closed'
    );
    expect(classifyCryptoStoreIndexedDbError('InvalidStateError while reading IDB')).toBe(
      'invalid_state'
    );
    expect(classifyCryptoStoreIndexedDbError('UnknownError while opening IDB')).toBe(
      'unknown_idb_error'
    );
  });

  it('classifies generic crypto store read/write errors', () => {
    expect(classifyCryptoStoreIndexedDbError('failed to read or write to the crypto store')).toBe(
      'crypto_store_error'
    );
  });

  it('ignores unrelated sync errors', () => {
    expect(classifyCryptoStoreIndexedDbError('Fetch is aborted')).toBeUndefined();
    expect(isCryptoStoreIndexedDbError('Fetch is aborted')).toBe(false);
  });

  it('tracks recent service worker controller changes within the recovery window', () => {
    markRecentServiceWorkerControllerChange(1_000);

    expect(hasRecentServiceWorkerControllerChange(1_000)).toBe(true);
    expect(hasRecentServiceWorkerControllerChange(1_000 + 119_999)).toBe(true);
  });

  it('expires stale service worker controller changes and clears the stored state', () => {
    const windowRecord = window as unknown as Record<string, unknown>;
    markRecentServiceWorkerControllerChange(1_000);

    expect(hasRecentServiceWorkerControllerChange(1_000 + 120_001)).toBe(false);
    expect(windowRecord[SW_CONTROLLER_CHANGED_AT_KEY]).toBeUndefined();
  });

  it('allows one recovery reload before falling back to cache clearing', () => {
    expect(getCryptoStoreRecoveryAction()).toBe('reload');
    expect(getCryptoStoreRecoveryAction()).toBe('clear_cache');
  });

  it('resets the recovery reload cap after a healthy sync', () => {
    expect(getCryptoStoreRecoveryAction()).toBe('reload');

    resetCryptoStoreRecoveryReloadCount();

    expect(getCryptoStoreRecoveryAction()).toBe('reload');
  });
});
