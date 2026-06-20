export type CryptoStoreIndexedDbErrorType =
  | 'transaction_aborted'
  | 'transaction_error'
  | 'connection_closing'
  | 'connection_closed'
  | 'invalid_state'
  | 'unknown_idb_error'
  | 'crypto_store_error';

export const classifyCryptoStoreIndexedDbError = (
  errorMessage: string
): CryptoStoreIndexedDbErrorType | undefined => {
  if (errorMessage.includes('Transaction aborted')) return 'transaction_aborted';
  if (errorMessage.includes('without an in-progress transaction')) return 'transaction_error';
  if (errorMessage.includes('database connection is closing')) return 'connection_closing';
  if (errorMessage.includes('database connection is closed')) return 'connection_closed';
  if (errorMessage.includes('InvalidStateError')) return 'invalid_state';
  if (errorMessage.includes('UnknownError')) return 'unknown_idb_error';
  if (errorMessage.includes('failed to read or write to the crypto store')) {
    return 'crypto_store_error';
  }
  return undefined;
};

export const isCryptoStoreIndexedDbError = (errorMessage: string): boolean =>
  classifyCryptoStoreIndexedDbError(errorMessage) !== undefined;

export const isCryptoStoreRuntimeRecoveryError = (errorMessage: string): boolean => {
  const errorType = classifyCryptoStoreIndexedDbError(errorMessage);
  if (!errorType) return false;

  if (
    errorType === 'transaction_aborted' ||
    errorType === 'transaction_error' ||
    errorType === 'connection_closing' ||
    errorType === 'connection_closed' ||
    errorType === 'crypto_store_error'
  ) {
    return true;
  }

  return (
    errorMessage.includes('crypto store') ||
    errorMessage.includes('IndexedDB') ||
    errorMessage.includes('IDB') ||
    errorMessage.includes('database connection is closing') ||
    errorMessage.includes('database connection is closed')
  );
};
