export type TimelineResizeAnchorTarget = 'bottom' | 'focus';

type TimelineResizeAnchorState = {
  atBottom: boolean;
  focusItem?: {
    highlight: boolean;
  };
  bottomSettleUntil: number;
  focusSettleUntil: number;
  now: number;
};

export const getTimelineResizeAnchorTarget = ({
  atBottom,
  focusItem,
  bottomSettleUntil,
  focusSettleUntil,
  now,
}: TimelineResizeAnchorState): TimelineResizeAnchorTarget | undefined => {
  if (focusItem?.highlight && now <= focusSettleUntil) {
    return 'focus';
  }

  if (atBottom && now <= bottomSettleUntil) {
    return 'bottom';
  }

  return undefined;
};
