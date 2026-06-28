export type TimelineResizeAnchorTarget = 'bottom' | 'focus';

type TimelineResizeAnchorState = {
  atBottom: boolean;
  focusItem?: {
    highlight: boolean;
  };
  focusSettleUntil: number;
  now: number;
};

export const getTimelineResizeAnchorTarget = ({
  atBottom,
  focusItem,
  focusSettleUntil,
  now,
}: TimelineResizeAnchorState): TimelineResizeAnchorTarget | undefined => {
  if (focusItem?.highlight && now <= focusSettleUntil) {
    return 'focus';
  }

  if (atBottom) {
    return 'bottom';
  }

  return undefined;
};
