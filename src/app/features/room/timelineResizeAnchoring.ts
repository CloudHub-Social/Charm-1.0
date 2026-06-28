export type TimelineResizeAnchorTarget = 'bottom' | 'focus';

type TimelineResizeAnchorState = {
  focusItem?: {
    highlight: boolean;
  };
  bottomSettleUntil: number;
  focusSettleUntil: number;
  now: number;
};

type TimelineResizeAnchorTargetState = TimelineResizeAnchorState & {
  atBottom: boolean;
};

export const shouldKeepTimelineResizeAnchorLoopRunning = ({
  focusItem,
  bottomSettleUntil,
  focusSettleUntil,
  now,
}: TimelineResizeAnchorState): boolean =>
  (Boolean(focusItem) && now <= focusSettleUntil) || now <= bottomSettleUntil;

export const getTimelineResizeAnchorTarget = ({
  atBottom,
  focusItem,
  bottomSettleUntil,
  focusSettleUntil,
  now,
}: TimelineResizeAnchorTargetState): TimelineResizeAnchorTarget | undefined => {
  if (focusItem && now <= focusSettleUntil) {
    return 'focus';
  }

  if (atBottom && now <= bottomSettleUntil) {
    return 'bottom';
  }

  return undefined;
};
