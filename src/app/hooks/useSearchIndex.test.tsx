import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchIndex, SearchIndexProvider } from './useSearchIndex';
import { ClientEvent, RoomEvent, SyncState } from '$types/matrix-sdk';

type SearchIndexValue = NonNullable<ReturnType<typeof useSearchIndex>>;

type WorkerListener = (event: MessageEvent) => void;

class MockWorker {
  public postMessage = vi.fn<(message: unknown) => void>();
  public terminate = vi.fn<() => void>();
  private listeners = new Map<string, Set<WorkerListener>>();

  addEventListener(type: string, listener: WorkerListener) {
    const listeners = this.listeners.get(type) ?? new Set<WorkerListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: WorkerListener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data: unknown) {
    const event = { data } as MessageEvent;
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

const mocks = vi.hoisted(() => {
  const rooms = [
    {
      roomId: '!room:example.org',
      isSpaceRoom: () => false,
    },
  ];
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const workerInstances: MockWorker[] = [];

  const mx = {
    getUserId: vi.fn<() => string | null>(() => '@alice:example.org'),
    getSyncState: vi.fn<() => SyncState>(() => SyncState.Prepared),
    getRooms: vi.fn<() => typeof rooms>(() => rooms),
    on: vi.fn<(event: string, listener: (...args: unknown[]) => void) => void>(
      (event: string, listener: (...args: unknown[]) => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
      }
    ),
    removeListener: vi.fn<(event: string, listener: (...args: unknown[]) => void) => void>(
      (event: string, listener: (...args: unknown[]) => void) => {
        listeners.get(event)?.delete(listener);
      }
    ),
  };

  return {
    mx,
    rooms,
    listeners,
    workerInstances,
    createWorker: vi.fn<() => MockWorker>(() => {
      const worker = new MockWorker();
      workerInstances.push(worker);
      return worker;
    }),
    useSetting: vi.fn<(_atom: unknown, key: string) => readonly [boolean | number, () => void]>(
      (_atom: unknown, key: string): readonly [boolean | number, () => void] => {
        if (key === 'idbSearchIndex') return [true, vi.fn<() => void>()] as const;
        if (key === 'searchIndexMessageLimit') return [2000, vi.fn<() => void>()] as const;
        throw new Error(`Unexpected setting ${key}`);
      }
    ),
  };
});

vi.mock('$hooks/useMatrixClient', () => ({
  useMatrixClient: () => mocks.mx,
}));

vi.mock('$state/hooks/settings', () => ({
  useSetting: (atom: unknown, key: string) => mocks.useSetting(atom, key),
}));

vi.mock('$state/settings', () => ({
  settingsAtom: {},
}));

vi.mock('$plugins/search-worker/searchWorker.ts?worker', () => ({
  default: function MockSearchWorker(this: unknown) {
    return mocks.createWorker();
  },
}));

vi.mock('$plugins/search-worker/workerLifecycle', () => ({
  buildSearchWorkerRuntimeErrorMessage: ({ message }: { message?: string }) =>
    `worker runtime failed: ${message ?? 'unknown'}`,
}));

vi.mock('@sentry/react', () => ({
  addBreadcrumb: vi.fn<(...args: unknown[]) => void>(),
  captureException: vi.fn<(...args: unknown[]) => void>(),
  captureMessage: vi.fn<(...args: unknown[]) => void>(),
}));

function SearchIndexConsumer({
  onContext,
}: {
  onContext: (value: ReturnType<typeof useSearchIndex>) => void;
}) {
  const value = useSearchIndex();
  onContext(value);
  return null;
}

describe('SearchIndexProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.workerInstances.length = 0;
    mocks.listeners.clear();
    mocks.mx.on.mockClear();
    mocks.mx.removeListener.mockClear();
    mocks.mx.getRooms.mockReturnValue(mocks.rooms);
    mocks.mx.getSyncState.mockReturnValue(SyncState.Prepared);
    mocks.createWorker.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('becomes ready and delays backfill startup until the grace period elapses', async () => {
    const seen: Array<ReturnType<typeof useSearchIndex>> = [];
    render(
      <SearchIndexProvider>
        <SearchIndexConsumer onContext={(value) => seen.push(value)} />
      </SearchIndexProvider>
    );

    const worker = mocks.workerInstances.at(-1);
    expect(worker).toBeDefined();

    await act(async () => {
      worker?.emit('message', { type: 'READY', indexedEventCount: 0, roomCount: 0 });
      worker?.emit('message', {
        type: 'BACKFILL_STATES',
        states: {
          '!room:example.org': { token: null, done: false, indexedCount: 0 },
        },
      });
    });

    const current = seen.at(-1);
    expect(current?.isReady).toBe(true);
    expect(current?.isBackfilling).toBe(true);
    expect(worker?.postMessage).toHaveBeenCalledWith({ type: 'GET_BACKFILL_STATES' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(worker?.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'INDEX_EVENTS' })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(mocks.mx.on).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
    expect(mocks.mx.on).toHaveBeenCalledWith(RoomEvent.Timeline, expect.any(Function));
    expect(mocks.mx.on).toHaveBeenCalledWith(ClientEvent.Room, expect.any(Function));
    expect(mocks.mx.on.mock.calls.filter(([event]) => event === ClientEvent.Sync)).toHaveLength(1);
    expect(mocks.mx.on.mock.calls.filter(([event]) => event === RoomEvent.Timeline)).toHaveLength(1);
    expect(mocks.mx.on.mock.calls.filter(([event]) => event === ClientEvent.Room)).toHaveLength(1);
  });

  it('settles pending queries with empty results when the worker reports an error', async () => {
    let latestContext: SearchIndexValue | null = null;
    render(
      <SearchIndexProvider>
        <SearchIndexConsumer onContext={(value) => value && (latestContext = value)} />
      </SearchIndexProvider>
    );

    const worker = mocks.workerInstances.at(-1);
    await act(async () => {
      worker?.emit('message', { type: 'READY', indexedEventCount: 0, roomCount: 0 });
    });

    expect(latestContext).not.toBeNull();
    const pending = latestContext!.query('hello');
    await act(async () => {
      worker?.emit('message', { type: 'ERROR', message: 'bad worker state' });
    });

    await expect(pending).resolves.toEqual([]);
    expect(latestContext!.isReady).toBe(false);
    expect(latestContext!.initError).toContain('Worker error: bad worker state');
  });

  it('rejects pending queries on unmount and removes runtime listeners', async () => {
    let latestContext: SearchIndexValue | null = null;
    const view = render(
      <SearchIndexProvider>
        <SearchIndexConsumer onContext={(value) => value && (latestContext = value)} />
      </SearchIndexProvider>
    );

    const worker = mocks.workerInstances.at(-1);
    await act(async () => {
      worker?.emit('message', { type: 'READY', indexedEventCount: 0, roomCount: 0 });
    });

    expect(latestContext).not.toBeNull();
    const pending = latestContext!.query('hello').then(
      () => ({ ok: true as const }),
      (error: unknown) => error
    );

    await act(async () => {
      view.unmount();
      worker?.emit('message', { type: 'INDEX_BATCH_DONE' });
      worker?.emit('message', { type: 'FLUSH_DONE' });
    });

    await expect(pending).resolves.toMatchObject({
      message: 'Search index unmounted',
    });
    expect(mocks.mx.removeListener).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function));
    expect(mocks.mx.removeListener).toHaveBeenCalledWith(RoomEvent.Timeline, expect.any(Function));
    expect(mocks.mx.removeListener).toHaveBeenCalledWith(ClientEvent.Room, expect.any(Function));
    expect(worker?.terminate).toHaveBeenCalled();
  });
});
