import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatrixClient } from '$types/matrix-sdk';
import type { Session } from '$state/sessions';
import type * as MatrixSdkModule from 'matrix-js-sdk/lib/matrix';

const { isTauri, invoke, initRustCrypto } = vi.hoisted(() => ({
  isTauri: vi.fn<() => boolean>(() => false),
  invoke: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
  initRustCrypto: vi.fn<(...args: unknown[]) => Promise<void>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
  isTauri,
}));

vi.mock('matrix-js-sdk/lib/matrix', async (importOriginal) => {
  const actual = await importOriginal<typeof MatrixSdkModule>();
  return {
    ...actual,
    createClient: (options: Parameters<typeof actual.createClient>[0]) => {
      const mx = actual.createClient(options);
      mx.initRustCrypto = initRustCrypto as MatrixClient['initRustCrypto'];
      mx.store.startup = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      mx.store.destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      return mx;
    },
  };
});

vi.mock('./versionsCache', () => ({
  primeVersionsFromCache: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
  revalidateVersionsCache: vi.fn<() => void>(),
  clearCachedVersions: vi.fn<() => void>(),
  cacheVersionsFromClient: vi.fn<() => void>(),
  wasUnstableFeatureCached: vi.fn<() => boolean>().mockReturnValue(false),
}));

import { initClient } from './initMatrix';

const session = (userId: string): Session => ({
  baseUrl: 'https://example.org',
  userId,
  deviceId: 'DEVICE',
  accessToken: 'access-token',
});

describe('initClient SDK crypto initialization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    isTauri.mockReturnValue(false);
    invoke.mockResolvedValue(undefined);
    initRustCrypto.mockResolvedValue(undefined);
  });

  it.each([false, true])('initializes SDK crypto in %s runtime', async (tauri) => {
    isTauri.mockReturnValue(tauri);
    await initClient(session(`@sdk-${tauri ? 'tauri' : 'browser'}:example.org`));

    expect(initRustCrypto).toHaveBeenCalledWith({
      cryptoDatabasePrefix: expect.stringContaining('sync@sdk-'),
    });
    expect(invoke.mock.calls.some(([command]) => command === 'engine_store_exists')).toBe(tauri);
    expect(invoke.mock.calls.some(([command]) => command === 'engine_open')).toBe(false);
  });

  it('rejects when a native crypto store exists before SDK initialization', async () => {
    isTauri.mockReturnValue(true);
    invoke.mockImplementation(async (command) => command === 'engine_store_exists');

    await expect(initClient(session('@native-store:example.org'))).rejects.toMatchObject({
      name: 'NativeCryptoStoreError',
    });

    expect(initRustCrypto).not.toHaveBeenCalled();
    expect(invoke.mock.calls.some(([command]) => command === 'engine_open')).toBe(false);
    expect(invoke.mock.calls.some(([command]) => command === 'engine_wipe')).toBe(false);
  });
});
