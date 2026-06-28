import { act, renderHook } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
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

function createDeferredPromise() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

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

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(2));
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

  it('preserves exponential backoff attempt state across repeated failures', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValue(new Error('temporary startup failure'));
    const input = createInput({ reconcilePushNotifications });

    renderHook(() => useWebPushStartupReconcilerEffect(input));

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(input.transportLog.warn).toHaveBeenLastCalledWith(
        'notification',
        'Web push startup reconciliation failed',
        expect.objectContaining({
          attempt: 1,
          nextRetryDelayMs: 5_000,
        })
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(input.transportLog.warn).toHaveBeenLastCalledWith(
        'notification',
        'Web push startup reconciliation failed',
        expect.objectContaining({
          attempt: 2,
          nextRetryDelayMs: 10_000,
        })
      )
    );
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 5_000);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 10_000);
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

  it('retries same-key failures after pushSubscription-driven rerenders', async () => {
    const firstAttempt = createDeferredPromise();
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockReturnValueOnce(firstAttempt.promise)
      .mockResolvedValueOnce(undefined);
    const initialInput = createInput({ reconcilePushNotifications });
    const updatedPushSubscription = [
      { endpoint: 'https://push.example/subscription' } as PushSubscriptionJSON,
      vi.fn<(subscription: PushSubscription | null) => void>(),
    ] as HookInput['pushSubscription'];
    const rerenderedInput = createInput({
      reconcilePushNotifications,
      pushSubscription: updatedPushSubscription,
    });

    const hook = renderHook(({ input }) => useWebPushStartupReconcilerEffect(input), {
      initialProps: { input: initialInput },
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));
    hook.rerender({ input: rerenderedInput });

    firstAttempt.reject(new Error('late startup failure'));
    await vi.waitFor(() =>
      expect(initialInput.transportLog.warn).toHaveBeenCalledWith(
        'notification',
        'Web push startup reconciliation failed',
        expect.objectContaining({
          attempt: 1,
          error: 'late startup failure',
          nextRetryDelayMs: 5_000,
        })
      )
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(2));
    expect(reconcilePushNotifications).toHaveBeenLastCalledWith(
      rerenderedInput.mx,
      rerenderedInput.clientConfig,
      rerenderedInput.webPushStartupPolicy.shouldEnablePusher,
      rerenderedInput.usePushNotifications,
      updatedPushSubscription
    );
  });

  it('does not bypass a scheduled retry on same-key rerenders', async () => {
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValueOnce(new Error('temporary startup failure'))
      .mockResolvedValueOnce(undefined);
    const initialInput = createInput({ reconcilePushNotifications });
    const rerenderedInput = createInput({
      reconcilePushNotifications,
      pushSubscription: [
        { endpoint: 'https://push.example/subscription' } as PushSubscriptionJSON,
        vi.fn<(subscription: PushSubscription | null) => void>(),
      ] as HookInput['pushSubscription'],
    });

    const hook = renderHook(({ input }) => useWebPushStartupReconcilerEffect(input), {
      initialProps: { input: initialInput },
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(initialInput.transportLog.warn).toHaveBeenCalledWith(
        'notification',
        'Web push startup reconciliation failed',
        expect.objectContaining({
          attempt: 1,
          nextRetryDelayMs: 5_000,
        })
      )
    );

    hook.rerender({ input: rerenderedInput });
    expect(reconcilePushNotifications).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(2));
  });

  it('stops retrying once the startup retry budget is exhausted', async () => {
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValue(new Error('persistent startup failure'));
    const initialInput = createInput({ reconcilePushNotifications });
    const rerenderedInput = createInput({
      reconcilePushNotifications,
      pushSubscription: [
        { endpoint: 'https://push.example/second-subscription' } as PushSubscriptionJSON,
        vi.fn<(subscription: PushSubscription | null) => void>(),
      ] as HookInput['pushSubscription'],
    });

    const hook = renderHook(({ input }) => useWebPushStartupReconcilerEffect(input), {
      initialProps: { input: initialInput },
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(6));
    await vi.waitFor(() =>
      expect(initialInput.transportLog.warn).toHaveBeenLastCalledWith(
        'notification',
        'Web push startup reconciliation failed',
        expect.objectContaining({
          attempt: 6,
          nextRetryDelayMs: undefined,
        })
      )
    );

    hook.rerender({ input: rerenderedInput });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(reconcilePushNotifications).toHaveBeenCalledTimes(6);
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

  it('keeps retry scheduling alive under Strict Mode remount checks', async () => {
    const reconcilePushNotifications = vi
      .fn<ReconcilePushNotifications>()
      .mockRejectedValueOnce(new Error('temporary startup failure'))
      .mockResolvedValueOnce(undefined);
    const input = createInput({ reconcilePushNotifications });
    renderHook(() => useWebPushStartupReconcilerEffect(input), { wrapper: StrictModeWrapper });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    await vi.waitFor(() => expect(reconcilePushNotifications).toHaveBeenCalledTimes(2));
  });
});
