export type RoomTimelineJumpMode =
  | 'history_context'
  | 'history_item'
  | 'notification_live'
  | undefined;

export const shouldKeepBottomPinnedAfterJump = (
  keepBottomPinned: boolean | undefined,
  jumpMode: RoomTimelineJumpMode,
  liveTimelineLinked: boolean,
  align?: 'center' | 'end'
): boolean =>
  keepBottomPinned ?? (jumpMode === 'notification_live' && liveTimelineLinked && align === 'end');

export type UnreadBridgeAction = 'idle' | 'complete' | 'paginate' | 'stop';

type UnreadBridgeActionInput = {
  active: boolean;
  awaitingContextLoad: boolean;
  liveTimelineLinked: boolean;
  reachedTarget: boolean;
  forwardStatus: 'idle' | 'loading' | 'error';
  attempts: number;
  maxAttempts?: number;
};

export const getUnreadBridgeAction = ({
  active,
  awaitingContextLoad,
  liveTimelineLinked,
  reachedTarget,
  forwardStatus,
  attempts,
  maxAttempts = 12,
}: UnreadBridgeActionInput): UnreadBridgeAction => {
  if (!active) return 'idle';
  if (awaitingContextLoad || forwardStatus === 'loading') return 'idle';
  if (forwardStatus === 'error') return attempts === 0 ? 'paginate' : 'stop';
  if (liveTimelineLinked) return reachedTarget ? 'complete' : 'stop';
  if (attempts >= maxAttempts) return 'stop';
  return 'paginate';
};

export type TimelineBottomScrollAction = 'ignore' | 'chase_bottom' | 'update_at_bottom';

type TimelineBottomScrollActionInput = {
  atBottom: boolean;
  isNowAtBottom: boolean;
  contentGrew: boolean;
  viewportChanged: boolean;
  withinSettleWindow: boolean;
  withinViewportChangeWindow: boolean;
};

export const getTimelineBottomScrollAction = ({
  atBottom,
  isNowAtBottom,
  contentGrew,
  viewportChanged,
  withinSettleWindow,
  withinViewportChangeWindow,
}: TimelineBottomScrollActionInput): TimelineBottomScrollAction => {
  if (atBottom && !isNowAtBottom && (contentGrew || viewportChanged || withinSettleWindow)) {
    return 'chase_bottom';
  }

  if (isNowAtBottom !== atBottom && !withinViewportChangeWindow) {
    return 'update_at_bottom';
  }

  return 'ignore';
};
