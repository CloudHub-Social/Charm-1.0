import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { installSmokeApp } from './smokeApp';

const snapshotOutputDir = process.env.PLAYWRIGHT_SNAPSHOT_OUTPUT_DIR;

const captureSnapshot = async (page: import('@playwright/test').Page, name: string) => {
  if (!snapshotOutputDir) return;

  const outputPath = path.join(snapshotOutputDir, `${name}.png`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: true });
};

test.describe('renderer polish smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installSmokeApp(page, { hashRouter: false });
  });

  test('renders inline code and code blocks without collapsing line metrics', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/renderer-markdown');
    await expect(page.getByTestId('smoke-inline-markdown')).toBeVisible();

    const inlineMetrics = await page
      .locator('[data-testid="smoke-inline-markdown"]')
      .evaluate((el) => {
        const code = el.querySelector('code');
        const getRect = (node: Element | null) => {
          if (!(node instanceof HTMLElement)) return null;
          const rect = node.getBoundingClientRect();
          return { height: rect.height, width: rect.width, top: rect.top, bottom: rect.bottom };
        };

        return {
          lineHeight: Number.parseFloat(getComputedStyle(el).lineHeight),
          body: getRect(el),
          code: getRect(code),
        };
      });

    expect(inlineMetrics.code).not.toBeNull();
    expect(inlineMetrics.body).not.toBeNull();
    expect(inlineMetrics.code!.height).toBeGreaterThan(inlineMetrics.lineHeight * 0.7);
    expect(inlineMetrics.code!.height).toBeLessThan(inlineMetrics.body!.height * 1.4);

    await expect(page.getByTestId('smoke-code-block')).toBeVisible();
    await captureSnapshot(page, 'renderer-polish/markdown');
  });

  test('keeps the shell background stable while swapping transition views', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/renderer-markdown');

    const initialBackground = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    }));

    await page.goto('/__smoke/mobile-shell/renderer-transitions');
    await expect(page.getByTestId('smoke-transition-title')).toHaveText('Spaces');

    const secondBackground = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    }));

    expect(initialBackground.html).toBe(secondBackground.html);
    expect(initialBackground.body).toBe(secondBackground.body);
    expect(initialBackground.body).not.toBe('rgba(0, 0, 0, 0)');

    await captureSnapshot(page, 'renderer-polish/transitions');
  });
});
