import { SearchOrderBy } from '$types/matrix-sdk';
import type { ResultGroup, ResultItem } from './useMessageSearch';

export type TimelineSearchItem = ResultItem & {
  roomId: string;
};

export const flattenTimelineSearchItems = (
  groups: ResultGroup[],
  order: SearchOrderBy
): TimelineSearchItem[] => {
  const items = groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      roomId: group.roomId,
    }))
  );

  if (order === SearchOrderBy.Rank) {
    return items;
  }

  return items.toSorted((a, b) => (b.event.origin_server_ts ?? 0) - (a.event.origin_server_ts ?? 0));
};
