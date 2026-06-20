import type { ResultGroup, ResultItem } from './useMessageSearch';

export type TimelineSearchItem = ResultItem & {
  roomId: string;
};

export const flattenTimelineSearchItems = (groups: ResultGroup[]): TimelineSearchItem[] =>
  groups
    .flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        roomId: group.roomId,
      }))
    )
    .toSorted((a, b) => (b.event.origin_server_ts ?? 0) - (a.event.origin_server_ts ?? 0));
