import type { MatrixClient } from '$types/matrix-sdk';

const appScopeClients = new WeakSet<MatrixClient>();
const retiredClients = new WeakSet<MatrixClient>();

export const markStoreDegradedRecoveryAppScope = (mx: MatrixClient): void => {
  appScopeClients.add(mx);
};

export const retireStoreDegradedRecoveryClient = (mx: MatrixClient): void => {
  retiredClients.add(mx);
};

export const canClientRequestStoreDegradedRecovery = (mx: MatrixClient): boolean =>
  appScopeClients.has(mx) && !retiredClients.has(mx);
