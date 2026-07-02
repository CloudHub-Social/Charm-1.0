import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { devices, expect, test } from '@playwright/test';
import { installSmokeApp, seedStoredSession, stubToolbar } from './smokeApp';

// Reproduces the three bugs from issue #490 and verifies the fixes via layout
// geometry checks in the mobile-shell fixture routes.

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

test.describe('issue #490 — mobile UI/UX regressions', () => {
  test.beforeEach(async ({ page }) => {
    await installSmokeApp(page, { authenticatedSession: true, hashRouter: false });
    await seedStoredSession(page);
    // See emoji-polish.spec.ts for why: Sentry's real dev toolbar (enabled
    // in the Sentry Snapshots CI job) would otherwise bleed into these
    // uploaded layout-harness screenshots -- and on the mobile viewport
    // these tests use, the toolbar overlay could plausibly overlap the
    // exact safe-area/notch gutters this file is checking.
    await stubToolbar(page);
  });

  // Bug #1: Image/media viewer was nearly full-screen but hard to exit because
  // ModalWide left only thin backdrop slivers — ≤600px should now be truly full-screen.
  test('ModalWide image viewer is full-screen on mobile viewport', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/image-viewer');
    const modal = page.getByTestId('smoke-modal-wide');
    await expect(modal).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('No viewport');

    const rect = await modal.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    // Allow 1px rounding tolerance.
    expect(rect.x).toBeLessThanOrEqual(1);
    expect(rect.y).toBeLessThanOrEqual(1);
    expect(rect.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(rect.height).toBeGreaterThanOrEqual(viewport.height - 1);

    await captureSnapshot(page, 'layout-harness/mobile-490/image-viewer-fullscreen');
  });

  // Bug #2: Account Switcher placed App Settings so close to the bottom that it
  // was overlapped by the iOS home indicator. The settings footer now uses
  // env(safe-area-inset-bottom) directly with a larger base padding.
  test('Account Switcher App Settings button is visible above safe-area zone', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/account-switcher');
    const footer = page.getByTestId('smoke-settings-footer');
    const appSettingsBtn = page.getByTestId('smoke-app-settings-btn');

    await expect(footer).toBeVisible();
    await expect(appSettingsBtn).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('No viewport');

    // The App Settings button's bottom edge should sit at least 12px above the
    // bottom of the viewport (S300 base padding, even with safe-area = 0 in CI).
    const rect = await appSettingsBtn.evaluate((el) => el.getBoundingClientRect());
    expect(rect.bottom).toBeLessThan(viewport.height - 10);

    await captureSnapshot(page, 'layout-harness/mobile-490/account-switcher-footer');
  });

  // Bug #3 (related): Message long-press sheet bottom padding — the menu element
  // must carry env(safe-area-inset-bottom) so the home indicator doesn't cover items.
  test('Mobile options sheet container is visible and has bottom clearance', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/mobile-options');
    const container = page.getByTestId('smoke-mobile-options-container');
    const menu = page.getByTestId('smoke-mobile-options-menu');
    const firstItem = page.getByTestId('smoke-mobile-options-item');

    await expect(container).toBeVisible();
    await expect(menu).toBeVisible();
    await expect(firstItem).toBeVisible();

    // Verify the menu element's stylesheet contains an env(safe-area-inset-bottom) rule.
    // getComputedStyle().paddingBottom always resolves to a px value (even when
    // no padding-bottom rule exists), so we must inspect the stylesheet directly.
    // The padding lives on MessageOptionsMenu (the absolutely-positioned child),
    // not on the outer MessageMobileOptionsContainer.
    const hasEnvPaddingRule = await menu.evaluate((el) => {
      const classes = Array.from(el.classList);
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (
              rule instanceof CSSStyleRule &&
              classes.some((cls) => rule.selectorText.includes(cls)) &&
              rule.cssText.includes('env(safe-area-inset-bottom')
            ) {
              return true;
            }
          }
        } catch {
          // cross-origin stylesheet — skip
        }
      }
      return false;
    });
    expect(hasEnvPaddingRule).toBe(true);

    await captureSnapshot(page, 'layout-harness/mobile-490/mobile-options-sheet');
  });

  // The image viewer header should have safe-area top padding on mobile so the
  // close button is accessible on notched phones.
  test('Image viewer header close button is reachable on notched viewport', async ({ page }) => {
    await page.goto('/__smoke/mobile-shell/image-viewer');
    const header = page.getByTestId('smoke-modal-wide-header');
    await expect(header).toBeVisible();

    // Header must start at the very top (y ≈ 0) and be tall enough to contain
    // a 44px touch target (48px minHeight set in the fixture).
    const rect = await header.evaluate((el) => el.getBoundingClientRect());
    expect(rect.y).toBeLessThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(44);

    await captureSnapshot(page, 'layout-harness/mobile-490/image-viewer-header');
  });
});
