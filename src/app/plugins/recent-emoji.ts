import type { MatrixClient } from '$types/matrix-sdk';

import { getAccountData } from '$utils/room';
import type { IEmoji } from './emoji';
import { emojis } from './emoji';
import { CustomAccountDataEvent } from '$types/matrix/accountData';

type EmojiUnicode = string;
type EmojiUsageCount = number;

/** Legacy io.element.recent_emoji shape: an array of [unicode, count] tuples. */
export type ILegacyRecentEmojiContent = {
  recent_emoji?: [EmojiUnicode, EmojiUsageCount][];
};

/** Stable m.recent_emoji entry shape per MSC4356 / Matrix v1.18. */
export type StableRecentEmojiEntry = {
  emoji: EmojiUnicode;
  total: EmojiUsageCount;
};

/** Stable m.recent_emoji shape per MSC4356 / Matrix v1.18. */
export type IRecentEmojiContent = {
  recent_emoji?: StableRecentEmojiEntry[];
};

const getStableRecentEmoji = (mx: MatrixClient): StableRecentEmojiEntry[] | undefined => {
  const stableEvent = getAccountData(mx, CustomAccountDataEvent.RecentEmoji);
  const stableEmoji = stableEvent?.getContent<IRecentEmojiContent>().recent_emoji;
  return Array.isArray(stableEmoji) ? stableEmoji : undefined;
};

const getLegacyRecentEmojiAsStable = (mx: MatrixClient): StableRecentEmojiEntry[] | undefined => {
  const legacyEvent = getAccountData(mx, CustomAccountDataEvent.LegacyElementRecentEmoji);
  const legacyEmoji = legacyEvent?.getContent<ILegacyRecentEmojiContent>().recent_emoji;
  if (!Array.isArray(legacyEmoji)) return undefined;
  return legacyEmoji.map(([emoji, total]) => ({ emoji, total }));
};

// Serializes migration and add-emoji writes per client so a pending legacy
// migration can't race a concurrent addRecentEmoji call and clobber it with
// a stale pre-migration snapshot (or vice versa).
const pendingRecentEmojiWrites = new WeakMap<MatrixClient, Promise<void>>();

function withRecentEmojiLock(mx: MatrixClient, run: () => Promise<void>): Promise<void> {
  const previous = pendingRecentEmojiWrites.get(mx) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(run);
  pendingRecentEmojiWrites.set(mx, next);
  return next;
}

export const getRecentEmojis = (mx: MatrixClient, limit?: number): IEmoji[] => {
  const recentEmoji = getStableRecentEmoji(mx) ?? getLegacyRecentEmojiAsStable(mx);
  if (!recentEmoji) return [];

  return recentEmoji
    .toSorted((e1, e2) => e2.total - e1.total)
    .slice(0, limit)
    .reduce<IEmoji[]>((list, { emoji: unicode }) => {
      const emoji = emojis.find((e) => e.unicode === unicode);
      if (emoji) list.push(emoji);
      return list;
    }, []);
};

/**
 * Migrates recent-emoji data from the legacy io.element.recent_emoji tuple
 * format to the stable m.recent_emoji key, converting to the MSC4356
 * { emoji, total } object schema. No-op if the stable key is already set.
 * Intended to be called from an effect, not during render, since it may
 * write account data.
 */
export function migrateLegacyRecentEmoji(mx: MatrixClient): Promise<void> {
  return withRecentEmojiLock(mx, async () => {
    if (getStableRecentEmoji(mx)) return;
    const legacyAsStable = getLegacyRecentEmojiAsStable(mx);
    if (!legacyAsStable) return;
    await mx.setAccountData(CustomAccountDataEvent.RecentEmoji, {
      recent_emoji: legacyAsStable,
    });
  });
}

export function addRecentEmoji(mx: MatrixClient, unicode: string): Promise<void> {
  return withRecentEmojiLock(mx, async () => {
    const recentEmoji = structuredClone(
      getStableRecentEmoji(mx) ?? getLegacyRecentEmojiAsStable(mx) ?? []
    );

    const emojiIndex = recentEmoji.findIndex((e) => e.emoji === unicode);
    let entry: StableRecentEmojiEntry;
    if (emojiIndex < 0) {
      entry = { emoji: unicode, total: 1 };
    } else {
      const spliced = recentEmoji.splice(emojiIndex, 1);
      entry = spliced[0] ?? { emoji: unicode, total: 1 };
      entry.total += 1;
    }
    recentEmoji.unshift(entry);
    await mx.setAccountData(CustomAccountDataEvent.RecentEmoji, {
      recent_emoji: recentEmoji.slice(0, 100),
    });
  });
}
