export type CryptoStoreIndexedDbErrorType =
  | 'transaction_aborted'
  | 'transaction_error'
  | 'connection_closed'
  | 'invalid_state'
  | 'unknown_idb_error'
  | 'crypto_store_error';

const SW_CONTROLLER_CHANGED_AT_KEY = '__swControllerChangedAt';
const SW_CONTROLLER_CHANGE_RECOVERY_WINDOW_MS = 2 * 60_000;
const CRYPTO_STORE_RECOVERY_RELOAD_COUNT_KEY = '__cryptoStoreRecoveryReloadCount';

export type CryptoStoreRecoveryAction = 'reload' | 'clear_cache';

const getWindowRecord = (): Record<string, unknown> | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window as unknown as Record<string, unknown>;
};

const getSessionStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.sessionStorage;
};

export const classifyCryptoStoreIndexedDbError = (
  errorMessage: string
): CryptoStoreIndexedDbErrorType | undefined => {
  if (errorMessage.includes('Transaction aborted')) return 'transaction_aborted';
  if (errorMessage.includes('without an in-progress transaction')) return 'transaction_error';
  if (errorMessage.includes('database connection is closed')) return 'connection_closed';
  if (errorMessage.includes('database connection is closing')) return 'connection_closed';
  if (errorMessage.includes('InvalidStateError')) return 'invalid_state';
  if (errorMessage.includes('UnknownError')) return 'unknown_idb_error';
  if (errorMessage.includes('failed to read or write to the crypto store')) {
    return 'crypto_store_error';
  }
  return undefined;
};

export const isCryptoStoreIndexedDbError = (errorMessage: string): boolean =>
  classifyCryptoStoreIndexedDbError(errorMessage) !== undefined;

export const markRecentServiceWorkerControllerChange = (now = Date.now()): void => {
  const windowRecord = getWindowRecord();
  if (!windowRecord) return;
  windowRecord[SW_CONTROLLER_CHANGED_AT_KEY] = now;
};

export const clearRecentServiceWorkerControllerChange = (): void => {
  const windowRecord = getWindowRecord();
  if (!windowRecord) return;
  delete windowRecord[SW_CONTROLLER_CHANGED_AT_KEY];
};

export const hasRecentServiceWorkerControllerChange = (now = Date.now()): boolean => {
  const windowRecord = getWindowRecord();
  if (!windowRecord) return false;
  const changedAt = windowRecord[SW_CONTROLLER_CHANGED_AT_KEY];
  if (typeof changedAt !== 'number') return false;
  if (now - changedAt > SW_CONTROLLER_CHANGE_RECOVERY_WINDOW_MS) {
    delete windowRecord[SW_CONTROLLER_CHANGED_AT_KEY];
    return false;
  }
  return true;
};

export const resetCryptoStoreRecoveryReloadCount = (): void => {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) return;
  sessionStorage.removeItem(CRYPTO_STORE_RECOVERY_RELOAD_COUNT_KEY);
};

export const getCryptoStoreRecoveryAction = (): CryptoStoreRecoveryAction => {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) return 'reload';
  const currentCount = Number(
    sessionStorage.getItem(CRYPTO_STORE_RECOVERY_RELOAD_COUNT_KEY) ?? '0'
  );
  if (currentCount >= 1) {
    return 'clear_cache';
  }
  sessionStorage.setItem(CRYPTO_STORE_RECOVERY_RELOAD_COUNT_KEY, String(currentCount + 1));
  return 'reload';
};
