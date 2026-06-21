import type { MatrixClient } from '$types/matrix-sdk';

const appScopeClients = new WeakSet<MatrixClient>();
const initializingAppClients = new WeakSet<MatrixClient>();
const retiredClients = new WeakSet<MatrixClient>();
let activeAppClient: MatrixClient | undefined;

export const markStoreDegradedRecoveryInitializingAppClient = (mx: MatrixClient): void => {
  appScopeClients.add(mx);
  initializingAppClients.add(mx);
};

export const markStoreDegradedRecoveryActiveAppClient = (mx: MatrixClient): void => {
  appScopeClients.add(mx);
  initializingAppClients.delete(mx);
  activeAppClient = mx;
};

export const retireStoreDegradedRecoveryClient = (mx: MatrixClient): void => {
  initializingAppClients.delete(mx);
  retiredClients.add(mx);
  if (activeAppClient === mx) {
    activeAppClient = undefined;
  }
};

export const canClientRequestStoreDegradedRecovery = (mx: MatrixClient): boolean => {
  if (!appScopeClients.has(mx) || retiredClients.has(mx)) {
    return false;
  }
  if (activeAppClient === mx) {
    return true;
  }
  return activeAppClient === undefined && initializingAppClients.has(mx);
};

export const resetStoreDegradedRecoveryClientsForTests = (): void => {
  activeAppClient = undefined;
};
