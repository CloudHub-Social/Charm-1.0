import { describe, expect, it, vi } from 'vitest';
import type { MatrixClient, MatrixEvent } from '$types/matrix-sdk';
import { CustomAccountDataEvent } from '$types/matrix/accountData';
import { emojis } from './emoji';
import { addRecentEmoji, getRecentEmojis, migrateLegacyRecentEmoji } from './recent-emoji';

const EMOJI_A = emojis[0]!.unicode;
const EMOJI_B = emojis[1]!.unicode;

function makeEvent(content: unknown): MatrixEvent {
  return { getContent: () => content } as unknown as MatrixEvent;
}

function makeClient(params: {
  stable?: unknown;
  legacy?: unknown;
  setAccountData?: MatrixClient['setAccountData'];
}): MatrixClient {
  return {
    getAccountData: (eventType: string) => {
      if (eventType === CustomAccountDataEvent.RecentEmoji) {
        return params.stable === undefined ? undefined : makeEvent(params.stable);
      }
      if (eventType === CustomAccountDataEvent.LegacyElementRecentEmoji) {
        return params.legacy === undefined ? undefined : makeEvent(params.legacy);
      }
      return undefined;
    },
    setAccountData: params.setAccountData ?? vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
  } as unknown as MatrixClient;
}

describe('recent-emoji plugin', () => {
  it('reads recent emojis from the stable m.recent_emoji key', () => {
    const mx = makeClient({
      stable: {
        recent_emoji: [
          { emoji: EMOJI_B, total: 1 },
          { emoji: EMOJI_A, total: 5 },
        ],
      },
    });

    expect(getRecentEmojis(mx).map((e) => e.unicode)).toEqual([EMOJI_A, EMOJI_B]);
  });

  it('falls back to the legacy tuple key and converts it to the stable shape', () => {
    const mx = makeClient({
      legacy: {
        recent_emoji: [
          [EMOJI_B, 1],
          [EMOJI_A, 5],
        ],
      },
    });

    expect(getRecentEmojis(mx).map((e) => e.unicode)).toEqual([EMOJI_A, EMOJI_B]);
  });

  it('migrates legacy tuple data to the stable { emoji, total } object schema', async () => {
    const setAccountData = vi.fn<() => Promise<unknown>>().mockResolvedValue({});
    const mx = makeClient({
      legacy: { recent_emoji: [[EMOJI_A, 3]] },
      setAccountData,
    });

    await migrateLegacyRecentEmoji(mx);

    expect(setAccountData).toHaveBeenCalledWith(CustomAccountDataEvent.RecentEmoji, {
      recent_emoji: [{ emoji: EMOJI_A, total: 3 }],
    });
  });

  it('does not migrate when the stable key already has data', async () => {
    const setAccountData = vi.fn<() => Promise<unknown>>().mockResolvedValue({});
    const mx = makeClient({
      stable: { recent_emoji: [{ emoji: EMOJI_A, total: 1 }] },
      legacy: { recent_emoji: [[EMOJI_B, 9]] },
      setAccountData,
    });

    await migrateLegacyRecentEmoji(mx);

    expect(setAccountData).not.toHaveBeenCalled();
  });

  it('writes new emoji usage using the stable object schema', () => {
    const setAccountData = vi.fn<() => Promise<unknown>>().mockResolvedValue({});
    const mx = makeClient({
      stable: { recent_emoji: [{ emoji: EMOJI_A, total: 1 }] },
      setAccountData,
    });

    addRecentEmoji(mx, EMOJI_A);

    expect(setAccountData).toHaveBeenCalledWith(CustomAccountDataEvent.RecentEmoji, {
      recent_emoji: [{ emoji: EMOJI_A, total: 2 }],
    });
  });
});
