import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../../../../..');

const readWorkspaceFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('sidebar icon sizing contract', () => {
  it('keeps the sticky bookmark tab aligned with the resized sidebar tabs', () => {
    const bookmarksTab = readWorkspaceFile('src/app/pages/client/sidebar/BookmarksTab.tsx');
    const searchTab = readWorkspaceFile('src/app/pages/client/sidebar/SearchTab.tsx');

    expect(searchTab).toMatch(/size=\{?['"]400['"]\}?/);
    expect(searchTab).toContain("getPhosphorIconSize(isBottom ? 'inline' : 'toolbar')");
    expect(bookmarksTab).toMatch(/size=\{?['"]400['"]\}?/);
    expect(bookmarksTab).toContain("getPhosphorIconSize('toolbar')");
  });
});
