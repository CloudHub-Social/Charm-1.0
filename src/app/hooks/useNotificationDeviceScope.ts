import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatrixClient, MatrixEvent } from "$types/matrix-sdk";
import { ClientEvent } from "$types/matrix-sdk";
import { useSetting } from "$state/hooks/settings";
import {
  settingsAtom,
  type NotificationDesktopDelayMinutes,
  type NotificationDeviceScope as NotificationDeviceScopeSetting,
} from "$state/settings";
import { CustomAccountDataEvent } from "$types/matrix/accountData";
import { mobileOrTablet } from "$utils/user-agent";

const NOTIFICATION_DEVICE_LEASE_EVENT_TYPE =
  CustomAccountDataEvent.SableNotificationDeviceLease as never;
const LOCAL_LEASE_UPDATE_EVENT = "sable:notification-device-lease-update";

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
    | "all_clients"
    | "missing_device_id"
    | "delay_disabled"
    | "no_fresh_lease"
    | "lease_holder"
    | "lease_held_elsewhere";
};

export function shouldEnableNotificationPusher(
  _isVisible: boolean,
  _isMobile: boolean,
  notificationDeviceScope: NotificationDeviceScopeSetting,
  _isActiveNotificationClient: boolean,
): boolean {
  void _isVisible;
  void _isMobile;
  void _isActiveNotificationClient;
  // Desktop-delay is enforced by the in-memory lease. Persistently disabling the
  // pusher can strand a secondary client without pushes if it closes before the
  // lease expires, so keep the server-side pusher registered in that mode.
  return (
    notificationDeviceScope === "desktop_delay" ||
    notificationDeviceScope === "all_clients"
  );
}

type UseNotificationDeviceScopeOptions = {
  publishLease?: boolean;
};

const LEASE_RENEW_MS = 30_000;
const LEASE_CLOCK_TICK_MS = 15_000;
const CLEAR_LEASE_RETRY_DELAY_MS = 60_000;
const resolveLeaseDurationMs = (
  delayMinutes: NotificationDesktopDelayMinutes,
): number => delayMinutes * 60_000;

const readLeaseContent = (
  mx: MatrixClient | undefined,
): NotificationDeviceLease | null => {
  if (!mx || typeof mx.getAccountData !== "function") return null;
  const content = mx
    .getAccountData(NOTIFICATION_DEVICE_LEASE_EVENT_TYPE)
    ?.getContent();
  if (!content || typeof content !== "object") return null;

  const deviceId =
    typeof content.deviceId === "string" ? content.deviceId.trim() : "";
  const updatedAt =
    typeof content.updatedAt === "number" ? content.updatedAt : NaN;
  const expiresAt =
    typeof content.expiresAt === "number" ? content.expiresAt : NaN;
  if (!deviceId || Number.isNaN(updatedAt) || Number.isNaN(expiresAt))
    return null;

  return { deviceId, updatedAt, expiresAt };
};

const isLeaseFresh = (
  lease: NotificationDeviceLease | null,
  now: number,
): boolean => !!lease && lease.expiresAt > now;

const broadcastLocalLeaseUpdate = (
  lease: NotificationDeviceLease | null,
): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationDeviceLease | null>(LOCAL_LEASE_UPDATE_EVENT, {
      detail: lease,
    }),
  );
};

export function useNotificationDeviceScope(
  mx: MatrixClient | undefined,
  options?: UseNotificationDeviceScopeOptions,
): NotificationDeviceScopeState {
  const shouldPublishLease = options?.publishLease ?? true;
  const [notificationDeviceScope] = useSetting(
    settingsAtom,
    "notificationDeviceScope",
  );
  const [notificationDesktopDelayMinutes] = useSetting(
    settingsAtom,
    "notificationDesktopDelayMinutes",
  );
  const [lease, setLease] = useState<NotificationDeviceLease | null>(() =>
    readLeaseContent(mx),
  );
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(() =>
    typeof document === "undefined" ? false : document.hasFocus(),
  );
  const [now, setNow] = useState<number>(() => Date.now());

  const leaseRef = useRef(lease);
  leaseRef.current = lease;
  const clearLeaseInFlightRef = useRef(false);
  const clearLeaseRetryAtRef = useRef(0);
  const previousShouldHoldLeaseRef = useRef(false);

  const deviceId =
    mx && typeof mx.getDeviceId === "function"
      ? (mx.getDeviceId() ?? undefined)
      : undefined;
  const leaseDurationMs = resolveLeaseDurationMs(
    notificationDesktopDelayMinutes,
  );
  const isMobileClient = mobileOrTablet();
  const desktopDelayEnabled =
    notificationDeviceScope === "desktop_delay" &&
    !!deviceId &&
    leaseDurationMs > 0;
  const canPublishLease = desktopDelayEnabled && !isMobileClient;
  const isVisible =
    typeof document !== "undefined" && document.visibilityState === "visible";
  const shouldHoldLease = canPublishLease && isVisible && isWindowFocused;
  const freshLease = isLeaseFresh(lease, now);
  const isThisClientLeaseHolder =
    !!deviceId && freshLease && lease?.deviceId === deviceId;
  const isActiveNotificationClient =
    !desktopDelayEnabled || !freshLease || isThisClientLeaseHolder;
  const shouldKeepWebPushEnabled =
    desktopDelayEnabled && isActiveNotificationClient;
  const activeReason: NotificationDeviceScopeState["activeReason"] =
    !desktopDelayEnabled
      ? deviceId
        ? notificationDeviceScope === "desktop_delay" && leaseDurationMs === 0
          ? "delay_disabled"
          : "all_clients"
        : "missing_device_id"
      : !freshLease
        ? "no_fresh_lease"
        : isThisClientLeaseHolder
          ? "lease_holder"
          : "lease_held_elsewhere";

  const clearLease = useCallback(
    (currentLease: NotificationDeviceLease | null): void => {
      if (!mx || !deviceId || typeof mx.setAccountData !== "function") return;
      if (clearLeaseInFlightRef.current) return;

      clearLeaseInFlightRef.current = true;
      setLease(null);
      broadcastLocalLeaseUpdate(null);
      const clearedLease = {} as never;
      mx.setAccountData(NOTIFICATION_DEVICE_LEASE_EVENT_TYPE, clearedLease)
        .then(() => {
          clearLeaseRetryAtRef.current = 0;
        })
        .catch(() => {
          clearLeaseRetryAtRef.current =
            Date.now() + CLEAR_LEASE_RETRY_DELAY_MS;
          setLease(currentLease ?? null);
          broadcastLocalLeaseUpdate(currentLease ?? null);
          setNow(Date.now());
        })
        .finally(() => {
          clearLeaseInFlightRef.current = false;
        });
    },
    [deviceId, mx],
  );

  const publishLease = useCallback(
    (nextNow: number, force = false): void => {
      if (
        !mx ||
        !canPublishLease ||
        !deviceId ||
        typeof mx.setAccountData !== "function"
      ) {
        return;
      }

      const currentLease = leaseRef.current;
      const leaseDurationChanged =
        !!currentLease &&
        Math.abs(
          currentLease.expiresAt - currentLease.updatedAt - leaseDurationMs,
        ) >
          LEASE_RENEW_MS / 2;
      if (
        !force &&
        currentLease?.deviceId === deviceId &&
        currentLease.expiresAt - nextNow > LEASE_RENEW_MS / 2 &&
        !leaseDurationChanged
      ) {
        return;
      }

      const nextLease: NotificationDeviceLease = {
        deviceId,
        updatedAt: nextNow,
        expiresAt: nextNow + leaseDurationMs,
      };
      setLease(nextLease);
      broadcastLocalLeaseUpdate(nextLease);
      mx.setAccountData(
        NOTIFICATION_DEVICE_LEASE_EVENT_TYPE,
        nextLease as never,
      ).catch(() => {
        setLease(currentLease ?? null);
        broadcastLocalLeaseUpdate(currentLease ?? null);
      });
    },
    [canPublishLease, deviceId, leaseDurationMs, mx],
  );

  useEffect(() => {
    setLease(readLeaseContent(mx));
  }, [mx]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setNow(Date.now()),
      LEASE_CLOCK_TICK_MS,
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      setNow(Date.now());
    };
    const handleBlur = () => {
      setIsWindowFocused(false);
      setNow(Date.now());
    };
    const handleVisibilityChange = () => setNow(Date.now());

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (
      !shouldPublishLease ||
      !mx ||
      !canPublishLease ||
      !deviceId ||
      typeof mx.setAccountData !== "function"
    ) {
      return undefined;
    }
    if (!shouldHoldLease) return undefined;

    const publishLeaseUpdate = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      publishLease(nextNow);
    };

    publishLeaseUpdate();
    const intervalId = window.setInterval(publishLeaseUpdate, LEASE_RENEW_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    canPublishLease,
    deviceId,
    mx,
    publishLease,
    shouldPublishLease,
    shouldHoldLease,
  ]);

  useEffect(() => {
    const wasHoldingLease = previousShouldHoldLeaseRef.current;
    previousShouldHoldLeaseRef.current = shouldHoldLease;
    if (!wasHoldingLease || shouldHoldLease) return;
    if (
      !desktopDelayEnabled ||
      !canPublishLease ||
      leaseRef.current?.deviceId !== deviceId
    )
      return;

    const nextNow = Date.now();
    setNow(nextNow);
    publishLease(nextNow, true);
  }, [
    canPublishLease,
    desktopDelayEnabled,
    deviceId,
    publishLease,
    shouldHoldLease,
  ]);

  useEffect(() => {
    if (
      !shouldPublishLease ||
      !mx ||
      !deviceId ||
      typeof mx.setAccountData !== "function"
    ) {
      return;
    }
    if (now < clearLeaseRetryAtRef.current) return;
    const currentLease = lease;
    if (currentLease?.deviceId !== deviceId) return;
    if (desktopDelayEnabled && canPublishLease) return;
    clearLease(currentLease);
  }, [
    canPublishLease,
    clearLease,
    desktopDelayEnabled,
    deviceId,
    lease,
    mx,
    now,
    shouldPublishLease,
  ]);

  useEffect(() => {
    const handleLocalLeaseUpdate = (event: Event) => {
      const detail = (event as CustomEvent<NotificationDeviceLease | null>)
        .detail;
      setLease(detail ?? null);
      setNow(Date.now());
    };

    window.addEventListener(
      LOCAL_LEASE_UPDATE_EVENT,
      handleLocalLeaseUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        LOCAL_LEASE_UPDATE_EVENT,
        handleLocalLeaseUpdate as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !mx ||
      typeof mx.on !== "function" ||
      typeof mx.removeListener !== "function"
    ) {
      return undefined;
    }

    const handleAccountData = (event: MatrixEvent) => {
      if (
        event.getType() !==
        (CustomAccountDataEvent.SableNotificationDeviceLease as string)
      ) {
        return;
      }
      setLease(readLeaseContent(mx));
      setNow(Date.now());
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
    };
  }, [mx]);

  return useMemo(
    () => ({
      deviceId,
      lease,
      leaseFresh: freshLease,
      leaseHolderDeviceId: lease?.deviceId,
      notificationDeviceScope,
      isVisible,
      isWindowFocused,
      isActiveNotificationClient,
      isThisClientLeaseHolder,
      shouldKeepWebPushEnabled,
      activeReason,
    }),
    [
      activeReason,
      deviceId,
      freshLease,
      lease,
      isVisible,
      isWindowFocused,
      notificationDeviceScope,
      isActiveNotificationClient,
      isThisClientLeaseHolder,
      shouldKeepWebPushEnabled,
    ],
  );
}
