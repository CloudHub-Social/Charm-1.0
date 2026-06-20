import { SearchOrderBy } from '$types/matrix-sdk';
import { describe, expect, it } from 'vitest';
import { SearchOrderBy } from '$types/matrix-sdk';
import { flattenTimelineSearchItems } from './messageSearchTimeline';
import type { ResultGroup } from './useMessageSearch';

const makeGroup = (roomId: string, timestamps: number[]): ResultGroup => ({
  roomId,
  items: timestamps.map((ts, index) => ({
    rank: index,
    event: {
      event_id: `$${roomId}-${ts}`,
      room_id: roomId,
      origin_server_ts: ts,
      content: {},
      sender: '@alice:smoke.test',
      type: 'm.room.message',
    },
    context: {
      events_before: [],
      events_after: [],
      profile_info: {},
      start: `start-${ts}`,
      end: `end-${ts}`,
    },
  })),
});

describe('flattenTimelineSearchItems', () => {
  it('interleaves ungrouped timeline results globally by timestamp instead of preserving room buckets', () => {
    const groups = [
      makeGroup('!room-a:smoke.test', [100, 90]),
      makeGroup('!room-b:smoke.test', [95, 85]),
    ];

    expect(
      flattenTimelineSearchItems(groups, SearchOrderBy.Recent).map((item) => [
        item.roomId,
        item.event.origin_server_ts,
      ])
    ).toEqual([
      ['!room-a:smoke.test', 100],
      ['!room-b:smoke.test', 95],
      ['!room-a:smoke.test', 90],
      ['!room-b:smoke.test', 85],
    ]);
  });

  it('preserves ranked timeline ordering when the user selects relevance sorting', () => {
    const groups = [
      makeGroup('!room-a:smoke.test', [100, 90]),
      makeGroup('!room-b:smoke.test', [95, 85]),
    ];

    expect(
      flattenTimelineSearchItems(groups, SearchOrderBy.Rank).map((item) => [
        item.roomId,
        item.event.origin_server_ts,
      ])
    ).toEqual([
      ['!room-a:smoke.test', 100],
      ['!room-a:smoke.test', 90],
      ['!room-b:smoke.test', 95],
      ['!room-b:smoke.test', 85],
    ]);
  });
});
