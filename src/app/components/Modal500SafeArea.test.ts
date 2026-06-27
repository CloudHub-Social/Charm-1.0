import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../../..');

const readWorkspaceFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('Modal500 safe-area contract', () => {
  it('leaves safe-area painting to full-screen page surfaces on mobile', () => {
    const modal = readWorkspaceFile('src/app/components/Modal500.tsx');
    const pageStyles = readWorkspaceFile('src/app/components/page/style.css.ts');

    expect(modal).toContain('backgroundColor: color.Background.Container');
    expect(modal).not.toContain("paddingTop: 'var(--sable-safe-area-top, 0px)'");
    expect(modal).not.toContain("paddingBottom: 'var(--sable-safe-area-bottom, 0px)'");
    expect(pageStyles).toContain("height: 'var(--sable-safe-area-top, 0px)'");
    expect(pageStyles).toContain('var(--sable-safe-area-bottom, 0px)');
  });
});
