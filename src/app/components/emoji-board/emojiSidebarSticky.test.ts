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
      /export const PinnedSidebarFooter\s*=\s*style\(\s*\{([\s\S]*?)\}\s*\)\s*;/
    );
    expect(pinnedFooterBlockMatch).not.toBeNull();
    const pinnedFooterBlock = pinnedFooterBlockMatch![1];

    expect(pinnedFooterBlock).toContain("position: 'absolute'");
    expect(pinnedFooterBlock).toContain('bottom: 0');
    expect(pinnedFooterBlock).not.toContain("bottom: '-67%'");
  });

  it('reserves horizontal space for the pinned footer when there is no in-flow sidebar', () => {
    const layout = readWorkspaceFile('src/app/components/emoji-board/components/Layout.tsx');

    // The emoji tab has no in-flow `sidebar` (EmojiSidebarPinned replaces it
    // entirely via pinnedSidebarFooter), so nothing else in the row claims
    // width for it. Without an explicit reservation, content grows the full
    // row width and the absolutely-positioned, right-anchored footer
    // overlaps (and can intercept clicks on) whatever sits underneath its
    // right edge — same failure mode as the paddingBottom footer-height
    // reservation just above, but horizontal.
    expect(layout).toContain('pinnedFooterWidth');
    expect(layout).toMatch(/paddingRight:\s*sidebar\s*\?\s*undefined\s*:\s*pinnedFooterWidth/);
  });

  it('prevents the sidebar stacks from flex-shrinking when packs push content past the pinned footer height', () => {
    const sidebar = readWorkspaceFile('src/app/components/emoji-board/components/Sidebar.tsx');

    // PinnedSidebarFooter's whole column (Recent + packs + standard groups)
    // is one flex column taller than the footer's own maxHeight:100% once a
    // user has enough packs. Without shrink="No" on each SidebarStack, the
    // default flex-shrink:1 compresses every stack's box to fit — the
    // fixed-size icon buttons inside don't shrink with it, so they overflow
    // past their own (squished) stack and visually overlap the next stack's
    // icons (e.g. a pack icon hidden under a standard-group icon). Confirmed
    // live: recreating this with real packs on a mobile viewport reproduced
    // the exact overlap, and shrink="No" fixed it.
    //
    // Match the whole SidebarStack export statement by its own closing
    // `));`, rather than bounding it against wherever SidebarDivider happens
    // to be exported next — that would break if the exports were ever
    // reordered. This is self-contained regardless of export order.
    const stackMatch = sidebar.match(/export const SidebarStack = as<'div'>\([\s\S]*?\)\);/);
    expect(stackMatch).not.toBeNull();
    expect(stackMatch![0]).toContain('shrink="No"');
  });
});
