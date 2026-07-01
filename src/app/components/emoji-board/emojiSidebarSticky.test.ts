import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../../../..');

const readWorkspaceFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('emoji sidebar pinned-footer contract', () => {
  it('renders the emoji group categories outside the shared scroll via a pinned anchor', () => {
    const emojiBoard = readWorkspaceFile('src/app/components/emoji-board/EmojiBoard.tsx');
    const stylesCss = readWorkspaceFile('src/app/components/emoji-board/components/styles.css.ts');

    // The standard emoji-group categories render via EmojiSidebarPinned,
    // passed as pinnedSidebarFooter — outside the content+sidebar shared
    // scroll, so they can never be scrolled out of reach.
    expect(emojiBoard).toContain('pinnedSidebarFooter={');
    expect(emojiBoard).toContain('EmojiSidebarPinned');

    // position: sticky doesn't reliably stay pinned once content and
    // sidebar share one scroll container (confirmed on real Chromium/
    // Android builds, not just the dev fixture) — guard against
    // reintroducing it for this group.
    expect(emojiBoard).not.toContain("position: 'sticky'");

    // The pinned footer must be genuinely anchored to the bottom via
    // position: absolute, not left to normal flow (which would scroll
    // away) or a previously-buggy percentage offset. Scope the check to
    // PinnedSidebarFooter's own style block specifically — styles.css.ts
    // has other unrelated position: 'absolute' / bottom: 0 declarations
    // (e.g. GIF overlays) that would make a file-wide match meaningless.
    const pinnedFooterBlockMatch = stylesCss.match(
      /export const PinnedSidebarFooter = style\(\{([\s\S]*?)\}\);/
    );
    expect(pinnedFooterBlockMatch).not.toBeNull();
    const pinnedFooterBlock = pinnedFooterBlockMatch![1];

    expect(pinnedFooterBlock).toContain("position: 'absolute'");
    expect(pinnedFooterBlock).toContain('bottom: 0');
    expect(pinnedFooterBlock).not.toContain("bottom: '-67%'");
  });
});
