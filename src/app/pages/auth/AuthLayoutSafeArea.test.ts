import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../../../..');

const readWorkspaceFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('auth layout safe-area contract', () => {
  it('keeps the unauthenticated layout centered and safe-area aware', () => {
    const authLayout = readWorkspaceFile('src/app/pages/auth/AuthLayout.tsx');
    const authStyles = readWorkspaceFile('src/app/pages/auth/styles.css.ts');

    expect(authLayout).toContain('justifyContent="Center"');
    expect(authStyles).toContain('paddingTop: config.space.S400');
    expect(authStyles).toContain('var(--sable-safe-area-bottom, 0px)');
  });
});
