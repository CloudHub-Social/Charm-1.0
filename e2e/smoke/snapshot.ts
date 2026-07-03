import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

const snapshotOutputDir = process.env.PLAYWRIGHT_SNAPSHOT_OUTPUT_DIR;

/**
 * Namespaces every capture by `testInfo.project.name` (`chromium` /
 * `mobile-android` / `mobile-ios`) so the same spec running under multiple
 * playwright.config.ts projects doesn't have one project's screenshot
 * silently overwrite another's at the same path.
 */
export const captureSnapshot = async (page: Page, testInfo: TestInfo, name: string) => {
  if (!snapshotOutputDir) return;

  const outputPath = path.join(snapshotOutputDir, testInfo.project.name, `${name}.png`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });
};
