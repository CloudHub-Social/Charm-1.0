/* oxlint-disable vitest/require-mock-type-parameters */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixClient } from '$types/matrix-sdk';
import { CustomAccountDataEvent } from '$types/matrix/accountData';
import {
  shouldEnableNotificationPusher,
  useNotificationDeviceScope,
} from './useNotificationDeviceScope';

let notificationDeviceScope: 'all_clients' | 'desktop_delay' = 'all_clients';
let notificationDesktopDelayMinutes: 0 | 1 | 2 | 5 | 10 = 2;
const { mockMobileOrTablet } = vi.hoisted(() => ({
  mockMobileOrTablet: vi.fn(() => false),
}));

vi.mock('$state/hooks/settings', () => ({
  useSetting: (_atom: unknown, key: string) => {
    if (key === 'notificationDesktopDelayMinutes') {
      return [notificationDesktopDelayMinutes, vi.fn()];
    }
    return [notificationDeviceScope, vi.fn()];
  },
}));

vi.mock('$utils/user-agent', () => ({
  mobileOrTablet: mockMobileOrTablet,
}));

function setVisibilityState(visibilityState: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
}

type LeaseContent = {
  deviceId: string;
  updatedAt: number;
  expiresAt: number;
};

function createMockMatrixClient(initialLease?: LeaseContent) {
  let lease = initialLease;
  let accountDataHandler: ((event: { getType: () => string }) => void) | undefined;

  const client = {
    getDeviceId: vi.fn(() => 'DEVICE_A'),
    getAccountData: vi.fn((type: string) => {
      if (type !== CustomAccountDataEvent.SableNotificationDeviceLease || lease === undefined) {
        return undefined;
      }

      return {
        getContent: () => lease,
      };
    }),
    setAccountData: vi.fn(async (_type: string, content: LeaseContent) => {
      lease = content;
    }),
    on: vi.fn((_event: string, handler: typeof accountDataHandler) => {
      accountDataHandler = handler;
    }),
    removeListener: vi.fn(),
  } as unknown as MatrixClient;

  return {
    client,
    setLease: (nextLease: LeaseContent | undefined) => {
      lease = nextLease;
    },
    emitAccountData: () => {
      accountDataHandler?.({
        getType: () => CustomAccountDataEvent.SableNotificationDeviceLease,
      });
    },
  };
}

describe('useNotificationDeviceScope', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
    notificationDeviceScope = 'all_clients';
    notificationDesktopDelayMinutes = 2;
    mockMobileOrTablet.mockReturnValue(false);
    setVisibilityState('visible');
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: () => true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats all-clients mode as always active without keeping web push enabled', () => {
    const { client } = createMockMatrixClient();

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    expect(result.current.notificationDeviceScope).toBe('all_clients');
    expect(result.current.isActiveNotificationClient).toBe(true);
    expect(result.current.shouldKeepWebPushEnabled).toBe(false);
    expect(result.current.activeReason).toBe('all_clients');
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isWindowFocused).toBe(true);
  });

  it('publishes an active lease for the focused visible client in desktop-delay mode', async () => {
    notificationDeviceScope = 'desktop_delay';
    const { client } = createMockMatrixClient();

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);
    expect(result.current.isThisClientLeaseHolder).toBe(true);
    expect(result.current.isActiveNotificationClient).toBe(true);
    expect(result.current.shouldKeepWebPushEnabled).toBe(true);
    expect(result.current.activeReason).toBe('lease_holder');
    expect(result.current.leaseFresh).toBe(true);
  });

  it('treats a fresh lease held by another client as inactive when this tab is not focused', () => {
    notificationDeviceScope = 'desktop_delay';
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: () => false,
    });

    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_B',
      updatedAt: now,
      expiresAt: now + 60_000,
    });

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    expect(result.current.isActiveNotificationClient).toBe(false);
    expect(result.current.isThisClientLeaseHolder).toBe(false);
    expect(result.current.shouldKeepWebPushEnabled).toBe(false);
    expect(result.current.activeReason).toBe('lease_held_elsewhere');
    expect(client.setAccountData).not.toHaveBeenCalled();
  });

  it('falls back to active when another client lease expires', () => {
    notificationDeviceScope = 'desktop_delay';
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: () => false,
    });

    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_B',
      updatedAt: now - 120_000,
      expiresAt: now - 1,
    });

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    expect(result.current.isActiveNotificationClient).toBe(true);
    expect(result.current.shouldKeepWebPushEnabled).toBe(true);
    expect(result.current.activeReason).toBe('no_fresh_lease');
  });

  it('updates the in-memory lease when account data changes arrive', async () => {
    notificationDeviceScope = 'desktop_delay';
    const { client, setLease, emitAccountData } = createMockMatrixClient();

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    const nextLease = {
      deviceId: 'DEVICE_B',
      updatedAt: Date.now(),
      expiresAt: Date.now() + 120_000,
    };

    act(() => {
      setLease(nextLease);
      emitAccountData();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.lease).toEqual(nextLease);
  });

  it('can read lease state without publishing duplicate leases', async () => {
    notificationDeviceScope = 'desktop_delay';
    const { client } = createMockMatrixClient();

    const { result } = renderHook(() =>
      useNotificationDeviceScope(client, {
        publishLease: false,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).not.toHaveBeenCalled();
    expect(result.current.isActiveNotificationClient).toBe(true);
    expect(result.current.shouldKeepWebPushEnabled).toBe(true);
  });

  it('shares optimistic lease updates with read-only consumers in the same tab', async () => {
    notificationDeviceScope = 'desktop_delay';
    const { client } = createMockMatrixClient();

    const owner = renderHook(() => useNotificationDeviceScope(client));
    const observer = renderHook(() =>
      useNotificationDeviceScope(client, {
        publishLease: false,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);
    expect(observer.result.current.isThisClientLeaseHolder).toBe(true);
    expect(observer.result.current.isActiveNotificationClient).toBe(true);

    owner.unmount();
    observer.unmount();
  });

  it('keeps desktop push enabled for all-clients scope while visible', () => {
    expect(shouldEnableNotificationPusher(true, false, 'all_clients', true)).toBe(true);
  });

  it('keeps pushers registered while desktop-delay suppression is active', () => {
    expect(shouldEnableNotificationPusher(true, true, 'desktop_delay', false)).toBe(true);
    expect(shouldEnableNotificationPusher(false, false, 'desktop_delay', false)).toBe(true);
  });

  it('treats a zero-minute desktop delay like notify-all semantics', () => {
    notificationDeviceScope = 'desktop_delay';
    notificationDesktopDelayMinutes = 0;
    const { client } = createMockMatrixClient();

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    expect(result.current.isActiveNotificationClient).toBe(true);
    expect(result.current.shouldKeepWebPushEnabled).toBe(false);
    expect(result.current.activeReason).toBe('delay_disabled');
  });

  it('clears an owned lease when desktop delay is disabled', async () => {
    notificationDeviceScope = 'desktop_delay';
    notificationDesktopDelayMinutes = 0;
    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_A',
      updatedAt: now,
      expiresAt: now + 120_000,
    });

    renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledWith(
      CustomAccountDataEvent.SableNotificationDeviceLease,
      {}
    );
  });

  it('does not let mobile clients renew desktop-delay leases', async () => {
    notificationDeviceScope = 'desktop_delay';
    mockMobileOrTablet.mockReturnValue(true);
    const { client } = createMockMatrixClient();

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).not.toHaveBeenCalled();
    expect(result.current.isActiveNotificationClient).toBe(true);
    expect(result.current.activeReason).toBe('no_fresh_lease');
  });

  it('clears an owned desktop-delay lease when this client cannot publish it', async () => {
    notificationDeviceScope = 'desktop_delay';
    mockMobileOrTablet.mockReturnValue(true);
    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_A',
      updatedAt: now,
      expiresAt: now + 120_000,
    });

    renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledWith(
      CustomAccountDataEvent.SableNotificationDeviceLease,
      {}
    );
  });

  it('lets mobile clients honor a fresh desktop-held lease without renewing it', async () => {
    notificationDeviceScope = 'desktop_delay';
    mockMobileOrTablet.mockReturnValue(true);
    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_B',
      updatedAt: now,
      expiresAt: now + 120_000,
    });

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).not.toHaveBeenCalled();
    expect(result.current.isActiveNotificationClient).toBe(false);
    expect(result.current.shouldKeepWebPushEnabled).toBe(false);
    expect(result.current.activeReason).toBe('lease_held_elsewhere');
  });

  it('does not clear an owned desktop-delay lease just because the tab is unfocused', async () => {
    notificationDeviceScope = 'desktop_delay';
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: () => false,
    });
    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_A',
      updatedAt: now,
      expiresAt: now + 120_000,
    });

    const { result } = renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).not.toHaveBeenCalled();
    expect(result.current.isThisClientLeaseHolder).toBe(true);
    expect(result.current.isActiveNotificationClient).toBe(true);
  });

  it('clears an owned lease when desktop delay is disabled after account data arrives', async () => {
    notificationDeviceScope = 'desktop_delay';
    notificationDesktopDelayMinutes = 0;
    const now = Date.now();
    const { client, setLease, emitAccountData } = createMockMatrixClient();

    renderHook(() => useNotificationDeviceScope(client));

    act(() => {
      setLease({
        deviceId: 'DEVICE_A',
        updatedAt: now,
        expiresAt: now + 120_000,
      });
      emitAccountData();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledWith(
      CustomAccountDataEvent.SableNotificationDeviceLease,
      {}
    );
  });

  it('backs off before retrying a failed lease clear', async () => {
    notificationDeviceScope = 'desktop_delay';
    notificationDesktopDelayMinutes = 0;
    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_A',
      updatedAt: now,
      expiresAt: now + 120_000,
    });

    vi.mocked(client.setAccountData).mockRejectedValueOnce(new Error('network'));

    renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(45_000);
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(2);
  });

  it('publishes a shorter lease immediately when the selected delay is reduced', async () => {
    notificationDeviceScope = 'desktop_delay';
    notificationDesktopDelayMinutes = 10;
    const now = Date.now();
    const { client } = createMockMatrixClient({
      deviceId: 'DEVICE_A',
      updatedAt: now,
      expiresAt: now + 10 * 60_000,
    });

    const { result, rerender } = renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    const initialExpiry = result.current.lease?.expiresAt ?? 0;
    notificationDesktopDelayMinutes = 1;

    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);
    expect((result.current.lease?.expiresAt ?? 0) - initialExpiry).toBeLessThan(0);
  });

  it('does not renew an unchanged lease on every interval tick', async () => {
    notificationDeviceScope = 'desktop_delay';
    const { client } = createMockMatrixClient();

    renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(client.setAccountData).toHaveBeenCalledTimes(1);
  });

  it('ignores stale lease publish failures after unmount', async () => {
    notificationDeviceScope = 'desktop_delay';
    let rejectSetAccountData: ((reason?: unknown) => void) | undefined;
    const { client } = createMockMatrixClient();
    client.setAccountData = vi.fn(
      () =>
        new Promise<Record<string, never>>((_, reject) => {
          rejectSetAccountData = reject;
        })
    ) as unknown as typeof client.setAccountData;

    const localUpdates: Array<LeaseContent | null> = [];
    const handleLeaseUpdate = (event: Event) => {
      localUpdates.push((event as CustomEvent<LeaseContent | null>).detail);
    };
    window.addEventListener('sable:notification-device-lease-update', handleLeaseUpdate);

    const { unmount } = renderHook(() => useNotificationDeviceScope(client));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      rejectSetAccountData?.(new Error('stale publish failed'));
      await Promise.resolve();
    });

    window.removeEventListener('sable:notification-device-lease-update', handleLeaseUpdate);
    expect(localUpdates.at(-1)).not.toBeNull();
  });
});
