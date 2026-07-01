import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installSmokeApp } from './smokeApp';

const snapshotOutputDir = process.env.PLAYWRIGHT_SNAPSHOT_OUTPUT_DIR;

const captureSnapshot = async (page: Page, name: string) => {
  if (!snapshotOutputDir) return;

  const outputPath = path.join(snapshotOutputDir, `${name}.png`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });
};

test.describe('GIF picker layout smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installSmokeApp(page, { hashRouter: false });
  });

  test('GIF picker fits within viewport gutter on a phone (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/__smoke/mobile-shell/gif-picker');

    const picker = page.getByTestId('smoke-gif-picker');
    await expect(picker).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();

    // GIF board uses 16px total gutter (8px each side), giving 374px on 390px viewport.
    expect(pickerBox!.width).toBeCloseTo(374, 0);

    // Left gutter ≥ 8px
    expect(pickerBox!.x).toBeGreaterThanOrEqual(8);
    // Right gutter ≥ 8px
    expect(390 - (pickerBox!.x + pickerBox!.width)).toBeGreaterThanOrEqual(8);

    await captureSnapshot(page, 'layout-harness/gif-picker/phone-390-gutter');
  });

  test('GIF picker is horizontally centered on a phone (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/__smoke/mobile-shell/gif-picker');

    const picker = page.getByTestId('smoke-gif-picker');
    await expect(picker).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();

    const leftGutter = pickerBox!.x;
    const rightGutter = 390 - (pickerBox!.x + pickerBox!.width);

    // Left and right gutters must match within 1px (centered).
    expect(Math.abs(leftGutter - rightGutter)).toBeLessThanOrEqual(1);

    await captureSnapshot(page, 'layout-harness/gif-picker/phone-390-centered');
  });

  test('GIF picker fits within viewport gutter on a narrow phone (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/__smoke/mobile-shell/gif-picker');

    const picker = page.getByTestId('smoke-gif-picker');
    await expect(picker).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();

    // 375 - 16 = 359px
    expect(pickerBox!.width).toBeCloseTo(359, 0);
    expect(pickerBox!.x).toBeGreaterThanOrEqual(8);
    expect(375 - (pickerBox!.x + pickerBox!.width)).toBeGreaterThanOrEqual(7);

    await captureSnapshot(page, 'layout-harness/gif-picker/phone-375-gutter');
  });

  test('GIF picker does not exceed 480px on wide viewports', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1000 });
    await page.goto('/__smoke/mobile-shell/gif-picker');

    const picker = page.getByTestId('smoke-gif-picker');
    await expect(picker).toBeVisible();

    const pickerBox = await picker.boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(pickerBox!.width).toBeLessThanOrEqual(480);

    await captureSnapshot(page, 'layout-harness/gif-picker/desktop-800-max-width');
  });
});
