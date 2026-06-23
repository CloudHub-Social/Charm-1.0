import { EventStatus } from '$types/matrix-sdk';

export const PENDING_SEND_DIM_DELAY_MS = 2000;

export const isPendingSendStatus = (sendStatus: EventStatus | null | undefined): boolean =>
  sendStatus === EventStatus.ENCRYPTING ||
  sendStatus === EventStatus.QUEUED ||
  sendStatus === EventStatus.SENDING;

export const getPendingSendDimDelayMs = (sentAt: number, now: number = Date.now()): number => {
  const elapsed = Math.max(0, now - sentAt);
  return Math.max(0, PENDING_SEND_DIM_DELAY_MS - elapsed);
};

export const shouldDimPendingSend = (
  sendStatus: EventStatus | null | undefined,
  sentAt: number,
  now: number = Date.now()
): boolean => isPendingSendStatus(sendStatus) && getPendingSendDimDelayMs(sentAt, now) === 0;
