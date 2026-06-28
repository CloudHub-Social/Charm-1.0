import { useEffect, useRef, useState } from 'react';
import type { ClientConfig } from '$hooks/useClientConfig';
import type { MatrixClient } from '$types/matrix-sdk';
import type { LogCategory } from '$utils/debugLogger';
import type { WebPushStartupReconcilerPolicy } from './webPushStartupReconcilerPolicy';

const WEB_PUSH_STARTUP_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000] as const;

type PushSubscriptionState = [
  PushSubscriptionJSON | null,
  (subscription: PushSubscription | null) => void,
];

type WebPushStartupReconcilerLogger = {
  warn: (
    scope: LogCategory,
    message: string,
    details: {
      userId: string | null;
      error: string;
      attempt: number;
      nextRetryDelayMs?: number;
    }
  ) => void;
};

type UseWebPushStartupReconcilerEffectInput = {
  mx: MatrixClient;
  clientConfig: ClientConfig;
  usePushNotifications: boolean;
  pushSubscription: PushSubscriptionState;
  webPushStartupPolicy: WebPushStartupReconcilerPolicy;
  reconcilePushNotifications: (
    mx: MatrixClient,
    clientConfig: ClientConfig,
    shouldEnable: boolean,
    usePushNotifications: boolean,
    pushSubscription: PushSubscriptionState
  ) => Promise<void>;
  transportLog: WebPushStartupReconcilerLogger;
};

export function useWebPushStartupReconcilerEffect({
  mx,
  clientConfig,
  usePushNotifications,
  pushSubscription,
  webPushStartupPolicy,
  reconcilePushNotifications,
  transportLog,
}: UseWebPushStartupReconcilerEffectInput): void {
  const mountedRef = useRef(true);
  const policyKeyRef = useRef<string | null>(null);
  const reconciledKeyRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextPolicyKey =
      webPushStartupPolicy.shouldReconcile && webPushStartupPolicy.reconcileKey
        ? webPushStartupPolicy.reconcileKey
        : null;

    if (policyKeyRef.current !== nextPolicyKey) {
      policyKeyRef.current = nextPolicyKey;
      reconciledKeyRef.current = null;
      retryAttemptRef.current = 0;
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    }

    if (!webPushStartupPolicy.shouldReconcile || !webPushStartupPolicy.reconcileKey) {
      return undefined;
    }
    if (reconciledKeyRef.current === webPushStartupPolicy.reconcileKey) {
      return undefined;
    }

    const reconcileKey = webPushStartupPolicy.reconcileKey;
    reconciledKeyRef.current = reconcileKey;

    void reconcilePushNotifications(
      mx,
      clientConfig,
      webPushStartupPolicy.shouldEnablePusher,
      usePushNotifications,
      pushSubscription
    ).catch((error) => {
      if (!mountedRef.current || policyKeyRef.current !== reconcileKey) return;

      const attempt = retryAttemptRef.current + 1;
      const nextRetryDelayMs = WEB_PUSH_STARTUP_RETRY_DELAYS_MS[retryAttemptRef.current];

      if (nextRetryDelayMs !== undefined) {
        retryAttemptRef.current = attempt;
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          reconciledKeyRef.current = null;
          setRetryNonce((value) => value + 1);
        }, nextRetryDelayMs);
      }

      transportLog.warn('notification', 'Web push startup reconciliation failed', {
        userId: mx.getUserId() ?? null,
        error: error instanceof Error ? error.message : String(error),
        attempt,
        nextRetryDelayMs,
      });
    });

    return undefined;
  }, [
    mx,
    clientConfig,
    pushSubscription,
    usePushNotifications,
    webPushStartupPolicy,
    reconcilePushNotifications,
    retryNonce,
    transportLog,
  ]);
}
