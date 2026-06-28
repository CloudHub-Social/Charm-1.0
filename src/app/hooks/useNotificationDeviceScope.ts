import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatrixClient, MatrixEvent } from '$types/matrix-sdk';
import { ClientEvent } from '$types/matrix-sdk';
import { useSetting } from '$state/hooks/settings';
import {
  settingsAtom,
  type NotificationDeviceScope as NotificationDeviceScopeSetting,
} from '$state/settings';
import { CustomAccountDataEvent } from '$types/matrix/accountData';

const NOTIFICATION_DEVICE_LEASE_EVENT_TYPE =
  CustomAccountDataEvent.SableNotificationDeviceLease as never;
const LOCAL_LEASE_UPDATE_EVENT = 'sable:notification-device-lease-update';

export type NotificationDeviceLease = {
  deviceId: string;
  updatedAt: number;
  expiresAt: number;
};

export type NotificationDeviceScopeState = {
  deviceId?: string;
  lease: NotificationDeviceLease | null;
  leaseFresh: boolean;
  leaseHolderDeviceId?: string;
  notificationDeviceScope: NotificationDeviceScopeSetting;
  isVisible: boolean;
  isWindowFocused: boolean;
  isActiveNotificationClient: boolean;
  isThisClientLeaseHolder: boolean;
  shouldKeepWebPushEnabled: boolean;
  activeReason:
    | 'all_clients'
    | 'missing_device_id'
    | 'no_fresh_lease'
    | 'lease_holder'
    | 'lease_held_elsewhere';
};

type VisibilityFocusState = {
  isVisible: boolean;
  isWindowFocused: boolean;
};

type DerivedNotificationDeviceScopeState = Pick<
  NotificationDeviceScopeState,
  | 'leaseFresh'
  | 'leaseHolderDeviceId'
  | 'isActiveNotificationClient'
  | 'isThisClientLeaseHolder'
  | 'shouldKeepWebPushEnabled'
  | 'activeReason'
>;

export function shouldEnableNotificationPusher(
  isVisible: boolean,
  isMobile: boolean,
  notificationDeviceScope: NotificationDeviceScopeSetting,
  isActiveNotificationClient: boolean
): boolean {
  return isVisible
    ? isMobile || isActiveNotificationClient
    : notificationDeviceScope !== 'active_client_only' || isActiveNotificationClient;
}

type UseNotificationDeviceScopeOptions = {
  publishLease?: boolean;
};

const LEASE_DURATION_MS = 2 * 60_000;
const LEASE_RENEW_MS = 30_000;
const LEASE_CLOCK_TICK_MS = 15_000;

const getCurrentTime = (): number => Date.now();

const getCurrentVisibilityState = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'visible';

const getCurrentFocusState = (): boolean => typeof document !== 'undefined' && document.hasFocus();

const readLeaseContent = (mx: MatrixClient | undefined): NotificationDeviceLease | null => {
  if (!mx || typeof mx.getAccountData !== 'function') return null;
  const content = mx.getAccountData(NOTIFICATION_DEVICE_LEASE_EVENT_TYPE)?.getContent();
  if (!content || typeof content !== 'object') return null;

  const deviceId = typeof content.deviceId === 'string' ? content.deviceId.trim() : '';
  const updatedAt = typeof content.updatedAt === 'number' ? content.updatedAt : NaN;
  const expiresAt = typeof content.expiresAt === 'number' ? content.expiresAt : NaN;
  if (!deviceId || Number.isNaN(updatedAt) || Number.isNaN(expiresAt)) return null;

  return { deviceId, updatedAt, expiresAt };
};

const isLeaseFresh = (lease: NotificationDeviceLease | null, now: number): boolean =>
  !!lease && lease.expiresAt > now;

const shouldRefreshLease = (
  lease: NotificationDeviceLease | null,
  deviceId: string,
  now: number
): boolean => !(lease?.deviceId === deviceId && lease.expiresAt - now > LEASE_RENEW_MS / 2);

const createLease = (deviceId: string, now: number): NotificationDeviceLease => ({
  deviceId,
  updatedAt: now,
  expiresAt: now + LEASE_DURATION_MS,
});

const deriveNotificationDeviceScopeState = (
  lease: NotificationDeviceLease | null,
  now: number,
  deviceId: string | undefined,
  notificationDeviceScope: NotificationDeviceScopeSetting
): DerivedNotificationDeviceScopeState => {
  const scopeEnabled = notificationDeviceScope === 'active_client_only' && !!deviceId;
  const leaseFresh = isLeaseFresh(lease, now);
  const isThisClientLeaseHolder = !!deviceId && leaseFresh && lease?.deviceId === deviceId;
  const isActiveNotificationClient = !scopeEnabled || !leaseFresh || isThisClientLeaseHolder;
  const shouldKeepWebPushEnabled = scopeEnabled && isActiveNotificationClient;
  const activeReason: NotificationDeviceScopeState['activeReason'] = !scopeEnabled
    ? deviceId
      ? 'all_clients'
      : 'missing_device_id'
    : !leaseFresh
      ? 'no_fresh_lease'
      : isThisClientLeaseHolder
        ? 'lease_holder'
        : 'lease_held_elsewhere';

  return {
    leaseFresh,
    leaseHolderDeviceId: lease?.deviceId,
    isActiveNotificationClient,
    isThisClientLeaseHolder,
    shouldKeepWebPushEnabled,
    activeReason,
  };
};

const broadcastLocalLeaseUpdate = (lease: NotificationDeviceLease | null): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<NotificationDeviceLease | null>(LOCAL_LEASE_UPDATE_EVENT, {
      detail: lease,
    })
  );
};

function useLeaseClock(): [number, () => void] {
  const [now, setNow] = useState<number>(() => getCurrentTime());
  const refreshNow = useCallback(() => setNow(getCurrentTime()), []);

  useEffect(() => {
    const intervalId = window.setInterval(refreshNow, LEASE_CLOCK_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshNow]);

  return [now, refreshNow];
}

function useVisibilityFocusState(refreshNow: () => void): VisibilityFocusState {
  const [state, setState] = useState<VisibilityFocusState>(() => ({
    isVisible: getCurrentVisibilityState(),
    isWindowFocused: getCurrentFocusState(),
  }));

  useEffect(() => {
    const syncFocusState = (isWindowFocused: boolean) => {
      setState((current) => ({ ...current, isWindowFocused }));
      refreshNow();
    };
    const syncVisibilityState = () => {
      setState((current) => ({
        ...current,
        isVisible: getCurrentVisibilityState(),
      }));
      refreshNow();
    };

    const handleFocus = () => syncFocusState(true);
    const handleBlur = () => syncFocusState(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', syncVisibilityState);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', syncVisibilityState);
    };
  }, [refreshNow]);

  return state;
}

export function useNotificationDeviceScope(
  mx: MatrixClient | undefined,
  options?: UseNotificationDeviceScopeOptions
): NotificationDeviceScopeState {
  const shouldPublishLease = options?.publishLease ?? true;
  const [notificationDeviceScope] = useSetting(settingsAtom, 'notificationDeviceScope');
  const [lease, setLease] = useState<NotificationDeviceLease | null>(() => readLeaseContent(mx));
  const [now, refreshNow] = useLeaseClock();
  const { isVisible, isWindowFocused } = useVisibilityFocusState(refreshNow);

  const leaseRef = useRef(lease);
  leaseRef.current = lease;

  const deviceId =
    mx && typeof mx.getDeviceId === 'function' ? (mx.getDeviceId() ?? undefined) : undefined;
  const scopeEnabled = notificationDeviceScope === 'active_client_only' && !!deviceId;
  const shouldHoldLease = scopeEnabled && isVisible && isWindowFocused;
  const derivedState = deriveNotificationDeviceScopeState(
    lease,
    now,
    deviceId,
    notificationDeviceScope
  );

  useEffect(() => {
    setLease(readLeaseContent(mx));
  }, [mx]);

  useEffect(() => {
    if (
      !shouldPublishLease ||
      !mx ||
      !scopeEnabled ||
      !deviceId ||
      typeof mx.setAccountData !== 'function'
    ) {
      return undefined;
    }
    if (!shouldHoldLease) return undefined;

    let cancelled = false;

    const publishLeaseUpdate = () => {
      const nextNow = getCurrentTime();
      refreshNow();
      const currentLease = leaseRef.current;
      if (!shouldRefreshLease(currentLease, deviceId, nextNow)) {
        return;
      }

      const nextLease = createLease(deviceId, nextNow);
      setLease(nextLease);
      broadcastLocalLeaseUpdate(nextLease);
      mx.setAccountData(NOTIFICATION_DEVICE_LEASE_EVENT_TYPE, nextLease as never).catch(() => {
        if (!cancelled) {
          setLease(currentLease ?? null);
          broadcastLocalLeaseUpdate(currentLease ?? null);
        }
      });
    };

    publishLeaseUpdate();
    const intervalId = window.setInterval(publishLeaseUpdate, LEASE_RENEW_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mx, deviceId, refreshNow, shouldPublishLease, scopeEnabled, shouldHoldLease]);

  useEffect(() => {
    const handleLocalLeaseUpdate = (event: Event) => {
      const detail = (event as CustomEvent<NotificationDeviceLease | null>).detail;
      setLease(detail ?? null);
      refreshNow();
    };

    window.addEventListener(LOCAL_LEASE_UPDATE_EVENT, handleLocalLeaseUpdate as EventListener);

    return () => {
      window.removeEventListener(LOCAL_LEASE_UPDATE_EVENT, handleLocalLeaseUpdate as EventListener);
    };
  }, [refreshNow]);

  useEffect(() => {
    if (!mx || typeof mx.on !== 'function' || typeof mx.removeListener !== 'function') {
      return undefined;
    }

    const handleAccountData = (event: MatrixEvent) => {
      if (event.getType() !== (CustomAccountDataEvent.SableNotificationDeviceLease as string)) {
        return;
      }
      setLease(readLeaseContent(mx));
      refreshNow();
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
    };
  }, [mx, refreshNow]);

  return useMemo(
    () => ({
      deviceId,
      lease,
      leaseFresh: derivedState.leaseFresh,
      leaseHolderDeviceId: derivedState.leaseHolderDeviceId,
      notificationDeviceScope,
      isVisible,
      isWindowFocused,
      isActiveNotificationClient: derivedState.isActiveNotificationClient,
      isThisClientLeaseHolder: derivedState.isThisClientLeaseHolder,
      shouldKeepWebPushEnabled: derivedState.shouldKeepWebPushEnabled,
      activeReason: derivedState.activeReason,
    }),
    [
      deviceId,
      derivedState.activeReason,
      derivedState.isActiveNotificationClient,
      derivedState.isThisClientLeaseHolder,
      derivedState.leaseFresh,
      derivedState.leaseHolderDeviceId,
      derivedState.shouldKeepWebPushEnabled,
      lease,
      isVisible,
      isWindowFocused,
      notificationDeviceScope,
    ]
  );
}
