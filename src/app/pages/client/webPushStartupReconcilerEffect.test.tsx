import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebPushStartupReconcilerPolicy } from './webPushStartupReconcilerPolicy';
import { useWebPushStartupReconcilerEffect } from './webPushStartupReconcilerEffect';

const defaultPolicy: WebPushStartupReconcilerPolicy = {
  shouldReconcile: true,
  shouldEnablePusher: true,
  reconcileKey: '@evie:example.com:visible:enabled',
};

type HookInput = Parameters<typeof useWebPushStartupReconcilerEffect>[0];
type ReconcilePushNotifications = HookInput['reconcilePushNotifications'];
type TransportWarn = HookInput['transportLog']['warn'];

function createInput(overrides?: Partial<HookInput>) {
  return {
    mx: {
      getUserId: vi.fn<() => string>(() => '@evie:example.com'),
    } as never,
    clientConfig: {} as never,
    usePushNotifications: true,
    pushSubscription: [null, vi.fn<(subscription: PushSubscription | null) => void>()] as never,
    webPushStartupPolicy: defaultPolicy,
    reconcilePushNotifications: vi.fn<ReconcilePushNotifications>().mockResolvedValue(undefined),
    transportLog: {
      warn: vi.fn<TransportWarn>(),
    },
    ...overrides,
  };
}

describe('useWebPushStartupReconcilerEffect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('retries the same startup reconciliation after a transient failure', async () => {
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValueOnce(new Error('temporary startup failure'))
      .mockResolvedValueOnce(undefined);
    const input = createInput({ reconcilePushNotifications });

    renderHook(() => useWebPushStartupReconcilerEffect(input));

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5_000);

    expect(reconcilePushNotifications).toHaveBeenCalledTimes(2);
    expect(input.transportLog.warn).toHaveBeenCalledWith(
      'notification',
      'Web push startup reconciliation failed',
      expect.objectContaining({
        attempt: 1,
        error: 'temporary startup failure',
        nextRetryDelayMs: 5_000,
      })
    );
  });

  it('cancels stale retry timers when the reconcile key changes', async () => {
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValueOnce(new Error('temporary startup failure'))
      .mockResolvedValue(undefined);
    const firstInput = createInput({ reconcilePushNotifications });
    const secondInput = createInput({
      reconcilePushNotifications,
      webPushStartupPolicy: {
        ...defaultPolicy,
        reconcileKey: '@evie:example.com:hidden:disabled',
        shouldEnablePusher: false,
      },
    });

    const hook = renderHook(({ input }) => useWebPushStartupReconcilerEffect(input), {
      initialProps: { input: firstInput },
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));

    hook.rerender({ input: secondInput });
    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(reconcilePushNotifications).toHaveBeenCalledTimes(2);
  });

  it('cleans up scheduled retries on unmount', async () => {
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValueOnce(new Error('temporary startup failure'));
    const input = createInput({ reconcilePushNotifications });

    const hook = renderHook(() => useWebPushStartupReconcilerEffect(input));

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));

    hook.unmount();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(reconcilePushNotifications).toHaveBeenCalledTimes(1);
  });
});
