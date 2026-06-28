import { describe, expect, it } from 'vitest';
import { getClientRootGuardTarget } from './rootHistoryGuard';

describe('getClientRootGuardTarget', () => {
  it('guards home room routes back to home while preserving homeView', () => {
    expect(
      getClientRootGuardTarget('/home/%21room%3Aexample/%24event%3Aexample', '?homeView=all')
    ).toBe('/home/?homeView=all');
  });

  it('guards direct, inbox, explore, and space child routes back to their section roots', () => {
    expect(getClientRootGuardTarget('/direct/%21room%3Aexample', '')).toBe('/direct/');
    expect(getClientRootGuardTarget('/inbox/notifications/', '')).toBe('/inbox/');
    expect(getClientRootGuardTarget('/explore/server.tld/', '?term=cat')).toBe('/explore/');
    expect(getClientRootGuardTarget('/%21space%3Aexample/search/', '')).toBe('/!space%3Aexample');
  });

  it('does not guard section roots or transient notification restore routes', () => {
    expect(getClientRootGuardTarget('/home/', '')).toBeUndefined();
    expect(getClientRootGuardTarget('/direct/', '')).toBeUndefined();
    expect(getClientRootGuardTarget('/to/%40alice%3Aexample/!room%3Aexample/%24event', '')).toBeUndefined();
  });
});
