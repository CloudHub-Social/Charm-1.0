import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { createStore, Provider } from 'jotai';
import { getSettings, presenceAutoIdledAtom, settingsAtom } from '$state/settings';
import { CustomAccountDataEvent } from '$types/matrix/accountData';
import { SetPresence } from '$types/matrix-sdk';
import { resetPresenceSyncThrottleForTests, usePresenceSyncEffect } from './usePresenceSync';

const PRESENCE_SYNC_UPDATED_AT_KEY = 'presence-sync-updated-at:@alice:example.com';

const sentry = vi.hoisted(() => ({
  addBreadcrumb: vi.fn<() => void>(),
  captureMessage: vi.fn<() => void>(),
}));

const { callbackHolder, mockMx, slidingSyncManager } = vi.hoisted(() => {
  const holder: {
    current: ((event: { getType: () => string; getContent: () => unknown }) => void) | null;
  } = { current: null };
  const sliding = {
    setPresenceEnabled: vi.fn<(enabled: boolean) => void>(),
  };
  const mx = {
    getUserId: vi.fn<() => string | undefined>().mockReturnValue('@alice:example.com'),
    getAccountData: vi.fn<() => unknown>().mockReturnValue(null),
    setAccountData: vi
      .fn<(type: string, content: Record<string, unknown>) => Promise<void>>()
      .mockResolvedValue(undefined),
    setPresence: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    setSyncPresence: vi.fn<(presence?: SetPresence) => void>(),
  };
  return { callbackHolder: holder, mockMx: mx, slidingSyncManager: sliding };
});

vi.mock('@sentry/react', () => sentry);

vi.mock('$hooks/useMatrixClient', () => ({
  useMatrixClient: () => mockMx,
}));

vi.mock('$hooks/useAccountDataCallback', () => ({
  useAccountDataCallback: (
    _mx: unknown,
    cb: (event: { getType: () => string; getContent: () => unknown }) => void
  ) => {
    callbackHolder.current = cb;
  },
}));

vi.mock('$client/initMatrix', () => ({
  getSlidingSyncManager: () => slidingSyncManager,
}));

vi.mock('$utils/debugLogger', () => ({
  createDebugLogger: () => ({
    info: vi.fn<() => void>(),
    warn: vi.fn<() => void>(),
    error: vi.fn<() => void>(),
  }),
}));

function makeStore(overrides?: Partial<ReturnType<typeof getSettings>>) {
  const store = createStore();
  store.set(settingsAtom, { ...getSettings(), ...overrides });
  store.set(presenceAutoIdledAtom, false);
  return store;
}

function makeWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(Provider, { store }, children);
  };
}

function makePresenceEvent(content: unknown) {
  return {
    getType: () => CustomAccountDataEvent.SablePresence,
    getContent: () => content,
  };
}

describe('usePresenceSyncEffect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    callbackHolder.current = null;
    resetPresenceSyncThrottleForTests();
    mockMx.getUserId.mockReset().mockReturnValue('@alice:example.com');
    mockMx.getAccountData.mockReset().mockReturnValue(null);
    mockMx.setAccountData.mockReset().mockResolvedValue(undefined);
    mockMx.setPresence.mockReset().mockResolvedValue(undefined);
    mockMx.setSyncPresence.mockReset();
    slidingSyncManager.setPresenceEnabled.mockReset();
    sentry.addBreadcrumb.mockReset();
    sentry.captureMessage.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not read or upload account data when sendPresence is disabled', () => {
    const store = makeStore({ sendPresence: false });
    renderHook(() => usePresenceSyncEffect(), { wrapper: makeWrapper(store) });

    act(() => {
      vi.runAllTimers();
    });

    expect(mockMx.getAccountData).not.toHaveBeenCalled();
    expect(mockMx.setAccountData).not.toHaveBeenCalled();
  });

  it('applies newer remote presence on mount when local freshness is older', () => {
    localStorage.setItem(PRESENCE_SYNC_UPDATED_AT_KEY, '100');
    mockMx.getAccountData.mockReturnValueOnce({
      getContent: () => ({
        presenceMode: 'offline',
        autoIdled: true,
        updatedAt: 200,
        lastActivityAt: 200,
      }),
    });

    const store = makeStore({ sendPresence: true, presenceMode: 'online' });
    renderHook(() => usePresenceSyncEffect(), { wrapper: makeWrapper(store) });

    expect(store.get(settingsAtom).presenceMode).toBe('offline');
    expect(store.get(presenceAutoIdledAtom)).toBe(true);
  });

  it('ignores stale remote presence updates once local state is newer', () => {
    localStorage.setItem(PRESENCE_SYNC_UPDATED_AT_KEY, '500');
    const store = makeStore({ sendPresence: true, presenceMode: 'online' });
    renderHook(() => usePresenceSyncEffect(), { wrapper: makeWrapper(store) });

    act(() => {
      callbackHolder.current?.(
        makePresenceEvent({
          presenceMode: 'offline',
          autoIdled: true,
          updatedAt: 400,
          lastActivityAt: 400,
        })
      );
    });

    expect(store.get(settingsAtom).presenceMode).toBe('online');
    expect(store.get(presenceAutoIdledAtom)).toBe(false);
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'presence-sync',
        message: 'Ignored stale remote presence state',
      })
    );
  });

  it('ignores account-data echoes for the current upload token', () => {
    const store = makeStore({ sendPresence: true, presenceMode: 'online' });
    renderHook(() => usePresenceSyncEffect(), { wrapper: makeWrapper(store) });

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    const uploadedContent = mockMx.setAccountData.mock.calls[0]?.[1];
    const echoToken = uploadedContent?.synctoken as string;

    act(() => {
      callbackHolder.current?.(
        makePresenceEvent({
          presenceMode: 'offline',
          autoIdled: true,
          updatedAt: 900,
          lastActivityAt: 900,
          synctoken: echoToken,
        })
      );
    });

    expect(store.get(settingsAtom).presenceMode).toBe('online');
    expect(store.get(presenceAutoIdledAtom)).toBe(false);
  });

  it('updates classic and sliding sync presence configuration when sending presence', async () => {
    const store = makeStore({ sendPresence: true, presenceMode: 'offline' });
    renderHook(() => usePresenceSyncEffect(), { wrapper: makeWrapper(store) });

    await act(async () => {
      vi.advanceTimersByTime(25_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMx.setPresence).toHaveBeenCalledWith({
      presence: 'offline',
      status_msg: undefined,
    });
    expect(mockMx.setSyncPresence).toHaveBeenCalledWith(SetPresence.Offline);
    expect(slidingSyncManager.setPresenceEnabled).toHaveBeenCalledWith(false);
  });
});
