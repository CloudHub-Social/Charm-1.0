import fs from 'node:fs/promises';
import path from 'node:path';
import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installSmokeApp } from './smokeApp';

const snapshotOutputDir = process.env.PLAYWRIGHT_SNAPSHOT_OUTPUT_DIR;

const captureSnapshot = async (page: Page, name: string) => {
  if (!snapshotOutputDir) return;

  const outputPath = path.join(snapshotOutputDir, `${name}.png`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });
};

test.use({
  ...devices['iPhone 13'],
  browserName: 'chromium',
});

test.describe('mobile composer polish smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installSmokeApp(page, { hashRouter: false });
  });

  test('keeps the mobile composer send area and following bar visible', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/composer-polish');

    await expect(page.getByTestId('smoke-mobile-composer')).toBeVisible();
    await expect(page.getByTestId('smoke-mobile-send-button')).toBeVisible();
    await expect(page.getByTestId('smoke-following-bar')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const composer = document.querySelector('[data-testid="smoke-mobile-composer"]');
      const sendButton = document.querySelector('[data-testid="smoke-mobile-send-button"]');
      const followingBar = document.querySelector('[data-testid="smoke-following-bar"]');
      const body = document.body.getBoundingClientRect();
      const getBox = (node: Element | null) => {
        if (!(node instanceof HTMLElement)) return null;
        const rect = node.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        };
      };

      return {
        viewportBottom: body.bottom,
        composer: getBox(composer),
        sendButton: getBox(sendButton),
        followingBar: getBox(followingBar),
      };
    });

    expect(metrics.composer).not.toBeNull();
    expect(metrics.sendButton).not.toBeNull();
    expect(metrics.followingBar).not.toBeNull();
    expect(metrics.sendButton!.right).toBeLessThanOrEqual(390);
    expect(metrics.followingBar!.bottom).toBeLessThanOrEqual(metrics.viewportBottom);
    expect(metrics.followingBar!.height).toBeGreaterThanOrEqual(28);

    await captureSnapshot(page, 'mobile-shell/composer-polish');
  });

  test('keeps the mobile long-press menu and reaction sheet centered inside the viewport', async ({
    page,
  }) => {
    await page.goto('/__smoke/mobile-shell/message-sheet');
    await expect(page.getByTestId('smoke-long-press-sheet')).toBeVisible();
    await captureSnapshot(page, 'mobile-shell/long-press-sheet');

    await page.goto('/__smoke/mobile-shell/reaction-sheet');
    await expect(page.getByTestId('smoke-reaction-sheet')).toBeVisible();
    await expect(page.getByTestId('smoke-mobile-reaction-picker')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="smoke-reaction-sheet"]');
      const picker = document.querySelector('[data-testid="smoke-mobile-reaction-picker"]');
      const getBox = (node: Element | null) => {
        if (!(node instanceof HTMLElement)) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      };

      return {
        sheet: getBox(sheet),
        picker: getBox(picker),
      };
    });

    expect(metrics.sheet).not.toBeNull();
    expect(metrics.picker).not.toBeNull();
    expect(metrics.picker!.left - metrics.sheet!.left).toBeGreaterThanOrEqual(8);
    expect(metrics.sheet!.right - metrics.picker!.right).toBeGreaterThanOrEqual(8);

    await captureSnapshot(page, 'mobile-shell/reaction-sheet');
  });
});
