import * as Sentry from '@sentry/react';
import type { MatrixClient } from '$types/matrix-sdk';
import { ClientEvent, MatrixEvent, SyncState } from '$types/matrix-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSentryMatrixDeviceContext,
  MATRIX_EVENT_FALLBACK_TYPE,
  normalizeMatrixEventType,
  resolveRefreshToken,
  setSentryMatrixDeviceContext,
  startClient,
  stopClient,
} from './initMatrix';
import {
  clearStoreDegradedRecoveryThrottle,
  requestStoreDegradedRecoveryReload,
  resetStoreDegradedRecoveryForTests,
} from './storeDegradedRecovery';

vi.mock('@sentry/react', () => ({
  addBreadcrumb: vi.fn<(breadcrumb: unknown) => void>(),
  captureMessage: vi.fn<(message: string, options?: unknown) => void>(),
  metrics: {
    count: vi.fn<(name: string, value?: number, options?: unknown) => void>(),
    distribution: vi.fn<(name: string, value: number, options?: unknown) => void>(),
  },
  startInactiveSpan: vi.fn<
    () => { setAttribute: (key: string, value: unknown) => void; end: () => void }
  >(() => ({
    setAttribute: vi.fn<(key: string, value: unknown) => void>(),
    end: vi.fn<() => void>(),
  })),
  setTag: vi.fn<(key: string, value: string) => void>(),
}));

const { mockReloadWithTelemetry } = vi.hoisted(() => ({
  mockReloadWithTelemetry: vi.fn<(reason: string, data?: Record<string, unknown>) => void>(),
}));

vi.mock('$utils/reloadWithTelemetry', () => ({
  reloadWithTelemetry: mockReloadWithTelemetry,
}));

type MockMatrixClient = MatrixClient & {
  retryImmediately: ReturnType<typeof vi.fn<() => boolean>>;
  startClient: ReturnType<typeof vi.fn<() => Promise<void>>>;
  stopClient: ReturnType<typeof vi.fn<() => void>>;
};

const startedClients: MockMatrixClient[] = [];

const makeClient = (
  userId: string,
  startPromise: Promise<void> = Promise.resolve()
): MockMatrixClient => {
  const client = {
    clientRunning: false,
    fetchRoomEvent: vi.fn<() => Promise<unknown>>(),
    getDeviceId: vi.fn<() => string>(() => `${userId}:DEVICE`),
    getRoom: vi.fn<() => undefined>(() => undefined),
    getRooms: vi.fn<() => unknown[]>(() => []),
    getSyncState: vi.fn<() => null>(() => null),
    getUserId: vi.fn<() => string>(() => userId),
    off: vi.fn<(...args: unknown[]) => void>(),
    on: vi.fn<(...args: unknown[]) => void>(),
    removeAllListeners: vi.fn<() => void>(),
    removeListener: vi.fn<(...args: unknown[]) => void>(),
    retryImmediately: vi.fn<() => boolean>(() => true),
    startClient: vi.fn<() => Promise<void>>(() => {
      client.clientRunning = true;
      return startPromise;
    }),
    stopClient: vi.fn<() => void>(() => {
      client.clientRunning = false;
    }),
  };

  return client as unknown as MockMatrixClient;
};

const makeDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const startClassicClient = async (mx: MockMatrixClient): Promise<void> => {
  startedClients.push(mx);
  await startClient(mx, {
    slidingSync: { enabled: false },
  });
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const setVisibilityState = (visibilityState: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
};

const waitForStopSettlement = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
  await flushMicrotasks();
};

afterEach(async () => {
  vi.useRealTimers();
  window.sessionStorage.clear();
  resetStoreDegradedRecoveryForTests();
  const clients = startedClients.splice(0);
  await Promise.all(clients.map((mx) => stopClient(mx)));
});

describe('resolveRefreshToken', () => {
  it('keeps the current refresh token when the homeserver omits refresh_token', () => {
    expect(resolveRefreshToken('refresh-2')).toBe('refresh-2');
    expect(resolveRefreshToken('refresh-2', 'refresh-3')).toBe('refresh-3');
  });
});

describe('normalizeMatrixEventType', () => {
  it('returns the original event type when it is a non-empty string', () => {
    expect(normalizeMatrixEventType('m.room.message')).toBe('m.room.message');
  });

  it('replaces empty or missing types with the fallback placeholder', () => {
    expect(normalizeMatrixEventType('')).toBe(MATRIX_EVENT_FALLBACK_TYPE);
    expect(normalizeMatrixEventType('   ')).toBe(MATRIX_EVENT_FALLBACK_TYPE);
    expect(normalizeMatrixEventType(undefined)).toBe(MATRIX_EVENT_FALLBACK_TYPE);
  });
});

describe('setSentryMatrixDeviceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('sets matrix.device_id from the Matrix client', () => {
    setSentryMatrixDeviceContext({ getDeviceId: () => 'CLIENTDEVICE' });

    expect(Sentry.setTag).toHaveBeenCalledWith('matrix.device_id', 'CLIENTDEVICE');
  });

  it('falls back to the session device ID before the SDK client is available', () => {
    setSentryMatrixDeviceContext(null, { deviceId: 'SESSIONDEVICE' });

    expect(Sentry.setTag).toHaveBeenCalledWith('matrix.device_id', 'SESSIONDEVICE');
  });

  it('does not overwrite the tag when no device ID is available', () => {
    setSentryMatrixDeviceContext({ getDeviceId: () => null }, null);

    expect(Sentry.setTag).not.toHaveBeenCalled();
  });

  it('clears the device ID tag for full login data clears', () => {
    clearSentryMatrixDeviceContext();

    expect(Sentry.setTag).toHaveBeenCalledWith('matrix.device_id', 'none');
  });
});

describe('requestStoreDegradedRecoveryReload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    resetStoreDegradedRecoveryForTests();
  });

  it('reloads immediately when the document is visible', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');

    expect(requestStoreDegradedRecoveryReload({ source: 'test' })).toBe(true);
    expect(mockReloadWithTelemetry).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockReloadWithTelemetry).toHaveBeenCalledWith('sync_store_degraded_recovery', {
      source: 'test',
    });
    vi.useRealTimers();
  });

  it('waits for visible resume when the document is hidden', async () => {
    setVisibilityState('hidden');

    expect(requestStoreDegradedRecoveryReload({ source: 'hidden' })).toBe(true);
    expect(mockReloadWithTelemetry).not.toHaveBeenCalled();

    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await flushMicrotasks();

    expect(mockReloadWithTelemetry).toHaveBeenCalledWith('sync_store_degraded_recovery', {
      source: 'hidden',
    });
  });

  it('suppresses duplicate recovery requests inside the throttle window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
    setVisibilityState('visible');

    expect(requestStoreDegradedRecoveryReload()).toBe(true);
    await vi.runAllTimersAsync();
    expect(mockReloadWithTelemetry).toHaveBeenCalledTimes(1);

    expect(requestStoreDegradedRecoveryReload()).toBe(false);
    expect(mockReloadWithTelemetry).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('keeps a hidden deferred recovery latched until the reload actually fires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
    setVisibilityState('hidden');

    expect(requestStoreDegradedRecoveryReload({ source: 'hidden' })).toBe(true);

    vi.setSystemTime(new Date('2026-06-21T12:02:00.000Z'));
    expect(requestStoreDegradedRecoveryReload({ source: 'duplicate' })).toBe(false);

    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await flushMicrotasks();

    expect(mockReloadWithTelemetry).toHaveBeenCalledTimes(1);
    expect(mockReloadWithTelemetry).toHaveBeenCalledWith('sync_store_degraded_recovery', {
      source: 'hidden',
    });
    vi.useRealTimers();
  });

  it('expires orphaned pending recovery markers after the throttle window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
    setVisibilityState('hidden');

    expect(requestStoreDegradedRecoveryReload({ source: 'hidden' })).toBe(true);

    resetStoreDegradedRecoveryForTests();
    vi.setSystemTime(new Date('2026-06-21T12:02:00.000Z'));

    expect(requestStoreDegradedRecoveryReload({ source: 'recovered' })).toBe(true);
    vi.useRealTimers();
  });

  it('does not reload when the recovery marker cannot be persisted', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(requestStoreDegradedRecoveryReload({ source: 'storage-failure' })).toBe(false);
    await vi.runAllTimersAsync();

    expect(mockReloadWithTelemetry).not.toHaveBeenCalled();
    setItem.mockRestore();
    vi.useRealTimers();
  });

  it('clears the persisted recovery throttle after the client stabilizes', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');

    expect(requestStoreDegradedRecoveryReload({ source: 'first' })).toBe(true);
    await vi.runAllTimersAsync();
    expect(requestStoreDegradedRecoveryReload({ source: 'second' })).toBe(false);

    clearStoreDegradedRecoveryThrottle();

    expect(requestStoreDegradedRecoveryReload({ source: 'third' })).toBe(true);
    vi.useRealTimers();
  });
});

describe('startClient app singleton gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses a pending app start for the same MatrixClient', async () => {
    const deferred = makeDeferred();
    const mx = makeClient('@alice:example.com', deferred.promise);

    const firstStart = startClassicClient(mx);
    await flushMicrotasks();
    const secondStart = startClassicClient(mx);
    await flushMicrotasks();

    expect(mx.startClient).toHaveBeenCalledTimes(1);
    deferred.resolve();
    await Promise.all([firstStart, secondStart]);
  });

  it('stops the previous app client before starting a replacement', async () => {
    const deferred = makeDeferred();
    const first = makeClient('@alice:example.com', deferred.promise);
    const second = makeClient('@bob:example.com');

    const firstStart = startClassicClient(first);
    await flushMicrotasks();
    const secondStart = startClassicClient(second);
    await flushMicrotasks();

    expect(first.stopClient).toHaveBeenCalledTimes(1);
    expect(second.startClient).not.toHaveBeenCalled();

    await waitForStopSettlement();
    expect(second.startClient).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await Promise.all([firstStart, secondStart]);
  });

  it('retries classic sync when the browser transitions from offline to online', async () => {
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    window.dispatchEvent(new Event('online'));
    expect(mx.retryImmediately).not.toHaveBeenCalled();

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event('online'));

    expect(mx.retryImmediately).toHaveBeenCalledOnce();

    await stopClient(mx);
    window.dispatchEvent(new Event('online'));

    expect(mx.retryImmediately).toHaveBeenCalledOnce();
  });

  it('retries classic sync when the window regains focus while visible', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    window.dispatchEvent(new Event('focus'));

    expect(mx.retryImmediately).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('focus'));
    expect(mx.retryImmediately).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(15_001);
    window.dispatchEvent(new Event('focus'));
    expect(mx.retryImmediately).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('retries classic sync on pageshow when visible again', async () => {
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(mx.retryImmediately).toHaveBeenCalledOnce();
  });

  it('requests degraded-store recovery when classic sync hits a crypto IndexedDB error', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');
    const syncListeners: Array<
      (state: SyncState, prevState: SyncState | null, data?: { error?: Error }) => void
    > = [];
    const mx = makeClient('@alice:example.com');
    mx.on = vi.fn<(...args: unknown[]) => MockMatrixClient>((event, listener) => {
      if (event === ClientEvent.Sync) {
        syncListeners.push(
          listener as (
            state: SyncState,
            prevState: SyncState | null,
            data?: { error?: Error }
          ) => void
        );
      }
      return mx;
    });

    await startClassicClient(mx);
    mx.clientRunning = true;
    const recoveryListener = syncListeners.find((listener) =>
      listener.toString().includes('requestStoreDegradedRecoveryReload')
    );

    expect(recoveryListener).toBeDefined();

    recoveryListener?.(SyncState.Reconnecting, SyncState.Syncing, {
      error: new Error("InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase'"),
    });
    await vi.runAllTimersAsync();

    expect(mockReloadWithTelemetry).toHaveBeenCalledWith(
      'sync_store_degraded_recovery',
      expect.objectContaining({
        errorType: 'invalid_state',
        syncState: SyncState.Reconnecting,
        transport: 'classic',
        userId: '@alice:example.com',
      })
    );
    vi.useRealTimers();
  });

  it('does not request degraded-store recovery for background-scoped clients', async () => {
    vi.useFakeTimers();
    setVisibilityState('visible');
    const syncListeners: Array<
      (state: SyncState, prevState: SyncState | null, data?: { error?: Error }) => void
    > = [];
    const mx = makeClient('@alice:example.com');
    mx.on = vi.fn<(...args: unknown[]) => MockMatrixClient>((event, listener) => {
      if (event === ClientEvent.Sync) {
        syncListeners.push(
          listener as (
            state: SyncState,
            prevState: SyncState | null,
            data?: { error?: Error }
          ) => void
        );
      }
      return mx;
    });

    startedClients.push(mx);
    await startClient(mx, {
      clientScope: 'background',
      slidingSync: { enabled: false },
    });

    const recoveryListener = syncListeners.find((listener) =>
      listener.toString().includes('requestStoreDegradedRecoveryReload')
    );

    recoveryListener?.(SyncState.Reconnecting, SyncState.Syncing, {
      error: new Error("InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase'"),
    });
    await vi.runAllTimersAsync();

    expect(mockReloadWithTelemetry).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not retry classic sync on non-persisted pageshow', async () => {
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));

    expect(mx.retryImmediately).not.toHaveBeenCalled();
  });

  it('retries classic sync on network reconnect while hidden', async () => {
    const mx = makeClient('@alice:example.com');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    await startClassicClient(mx);

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event('online'));

    expect(mx.retryImmediately).toHaveBeenCalledOnce();
  });

  it('stubs startup fetchRoomEvent misses with a stable placeholder event type', async () => {
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    await expect(mx.fetchRoomEvent('!room:example.com', '$event')).resolves.toMatchObject({
      event_id: '$event',
      room_id: '!room:example.com',
      type: MATRIX_EVENT_FALLBACK_TYPE,
      content: {},
    });
  });

  it('guards malformed MatrixEvent types after startup without returning undefined', async () => {
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    const malformedEvent = new MatrixEvent({
      event_id: '$bad',
      room_id: '!room:example.com',
      content: {},
      sender: '@alice:example.com',
      type: undefined,
    } as unknown as ConstructorParameters<typeof MatrixEvent>[0]);

    expect(malformedEvent.getType()).toBe(MATRIX_EVENT_FALLBACK_TYPE);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('MatrixEvent missing string event type', {
      level: 'warning',
      tags: { component: 'matrix-event-type-guard' },
      extra: {
        rawType: 'undefined',
        fallbackType: MATRIX_EVENT_FALLBACK_TYPE,
      },
    });
  });

  it('reports whitespace event types with the original raw value', async () => {
    const mx = makeClient('@alice:example.com');

    await startClassicClient(mx);

    const malformedEvent = new MatrixEvent({
      event_id: '$bad-space',
      room_id: '!room:example.com',
      content: {},
      sender: '@alice:example.com',
      type: '   ',
    } as unknown as ConstructorParameters<typeof MatrixEvent>[0]);

    expect(malformedEvent.getType()).toBe(MATRIX_EVENT_FALLBACK_TYPE);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('MatrixEvent missing string event type', {
      level: 'warning',
      tags: { component: 'matrix-event-type-guard' },
      extra: {
        rawType: '   ',
        fallbackType: MATRIX_EVENT_FALLBACK_TYPE,
      },
    });
  });
});
