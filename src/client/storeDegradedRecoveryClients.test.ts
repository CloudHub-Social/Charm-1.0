import { afterEach, describe, expect, it } from 'vitest';
import type { MatrixClient } from '$types/matrix-sdk';
import {
  canClientRequestStoreDegradedRecovery,
  markStoreDegradedRecoveryActiveAppClient,
  markStoreDegradedRecoveryInitializingAppClient,
  resetStoreDegradedRecoveryClientsForTests,
  retireStoreDegradedRecoveryClient,
} from './storeDegradedRecoveryClients';

const makeClient = (): MatrixClient => ({}) as MatrixClient;

afterEach(() => {
  resetStoreDegradedRecoveryClientsForTests();
});

describe('store degraded recovery client eligibility', () => {
  it('allows an initializing app client to recover before first app start completes', () => {
    const mx = makeClient();

    markStoreDegradedRecoveryInitializingAppClient(mx);

    expect(canClientRequestStoreDegradedRecovery(mx)).toBe(true);
  });

  it('keeps a replacement init client ineligible while another app client is active', () => {
    const active = makeClient();
    const replacement = makeClient();

    markStoreDegradedRecoveryInitializingAppClient(active);
    markStoreDegradedRecoveryActiveAppClient(active);
    markStoreDegradedRecoveryInitializingAppClient(replacement);

    expect(canClientRequestStoreDegradedRecovery(active)).toBe(true);
    expect(canClientRequestStoreDegradedRecovery(replacement)).toBe(false);
  });

  it('blocks retired clients from requesting recovery', () => {
    const mx = makeClient();

    markStoreDegradedRecoveryInitializingAppClient(mx);
    retireStoreDegradedRecoveryClient(mx);

    expect(canClientRequestStoreDegradedRecovery(mx)).toBe(false);
  });
});
