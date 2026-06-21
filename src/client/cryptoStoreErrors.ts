export type CryptoStoreIndexedDbErrorType =
  | 'transaction_aborted'
  | 'transaction_error'
  | 'connection_closed'
  | 'invalid_state'
  | 'unknown_idb_error'
  | 'crypto_store_error';

export const classifyCryptoStoreIndexedDbError = (
  errorMessage: string,
  errorName?: string
): CryptoStoreIndexedDbErrorType | undefined => {
  const classifierInput = `${errorName ?? ''} ${errorMessage}`;

  if (classifierInput.includes('Transaction aborted')) return 'transaction_aborted';
  if (classifierInput.includes('without an in-progress transaction')) return 'transaction_error';
  if (classifierInput.includes('database connection is closed')) return 'connection_closed';
  if (classifierInput.includes('InvalidStateError')) return 'invalid_state';
  if (classifierInput.includes('UnknownError')) return 'unknown_idb_error';
  if (classifierInput.includes('failed to read or write to the crypto store')) {
    return 'crypto_store_error';
  }
  return undefined;
};

export const isCryptoStoreIndexedDbError = (errorMessage: string): boolean =>
  classifyCryptoStoreIndexedDbError(errorMessage) !== undefined;
