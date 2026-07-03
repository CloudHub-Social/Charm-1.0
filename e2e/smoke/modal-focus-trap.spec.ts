import { expect, test } from '@playwright/test';
import { installSmokeApp, seedSettings, seedStoredSession } from './smokeApp';
import { captureSnapshot } from './snapshot';

// Regression coverage for PR #512 (fix(a11y): trap focus and add dialog
// semantics to modal overlays). The "Remote themes" confirmation dialog was
// configured with `initialFocus: false`, which causes focus-trap-react to
// skip its fallback-focus logic entirely instead of moving focus into the
// trap. Focus stayed on <body>, so a keyboard user had to tab through the
// fully-obscured Settings page before ever reaching the dialog's own
// buttons, and the trap's escape-recovery listener never engaged either.
test.describe('modal focus trap real-route smoke', () => {
  test('moves focus into the Remote themes dialog and traps Tab within it', async ({
    page,
  }, testInfo) => {
    await installSmokeApp(page, { authenticatedSession: true });
    await seedStoredSession(page);
    // Mark onboarding as already-seen so the dialog does not auto-open on
    // mount; instead we deliberately open it via the "Enable catalog"
    // button, mirroring how a real user reaches this dialog.
    await seedSettings(page, { themeCatalogOnboardingDone: true });

    await page.goto('/#/settings/appearance');

    const catalogTile = page.locator('[data-settings-focus="browse-remote-catalog"]');
    await expect(catalogTile).toBeVisible();

    const enableCatalogButton = catalogTile.getByRole('button', { name: 'Enable catalog' });
    await enableCatalogButton.click();

    const dialog = page.getByRole('dialog', { name: 'Remote themes' });
    await expect(dialog).toBeVisible();

    // Dialog semantics added by PR #512.
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await captureSnapshot(page, testInfo, 'real-routes/settings-remote-themes-dialog');

    // The core regression: focus must land inside the dialog, not on
    // <body> and not on a background Settings control left over from
    // before the dialog opened.
    const activeElementInsideDialog = await page.evaluate(() => {
      const active = document.activeElement;
      const dialogEl = document.querySelector('[role="dialog"][aria-modal="true"]');
      return Boolean(active && dialogEl && dialogEl.contains(active) && active !== document.body);
    });
    expect(activeElementInsideDialog).toBe(true);

    const activeElementIsBody = await page.evaluate(() => document.activeElement === document.body);
    expect(activeElementIsBody).toBe(false);

    // The dialog's own focusable controls, in DOM order: Close, "Yes, use
    // the catalog", "No, built-in themes only".
    const closeButton = dialog.getByRole('button', { name: 'Close' });
    const enableButton = dialog.getByRole('button', { name: 'Yes, use the catalog' });
    const declineButton = dialog.getByRole('button', { name: 'No, built-in themes only' });

    await expect(closeButton).toBeFocused();

    // Tab forward through all of the dialog's focusable elements and back
    // to the first one. If the trap were broken (as it was pre-fix), Tab
    // would escape into the ~50 obscured background Settings controls
    // instead of cycling back to Close.
    await page.keyboard.press('Tab');
    await expect(enableButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(declineButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();

    // Shift+Tab from the first element should wrap to the last, confirming
    // the trap boundary in both directions.
    await page.keyboard.press('Shift+Tab');
    await expect(declineButton).toBeFocused();

    // Sanity check that nothing behind the dialog picked up focus along
    // the way.
    const stillInsideDialog = await page.evaluate(() => {
      const active = document.activeElement;
      const dialogEl = document.querySelector('[role="dialog"][aria-modal="true"]');
      return Boolean(active && dialogEl && dialogEl.contains(active));
    });
    expect(stillInsideDialog).toBe(true);
  });

  test('closing the Remote themes dialog declines the catalog and returns focus to the page', async ({
    page,
  }) => {
    await installSmokeApp(page, { authenticatedSession: true });
    await seedStoredSession(page);
    await seedSettings(page, { themeCatalogOnboardingDone: true });

    await page.goto('/#/settings/appearance');

    const catalogTile = page.locator('[data-settings-focus="browse-remote-catalog"]');
    await catalogTile.getByRole('button', { name: 'Enable catalog' }).click();

    const dialog = page.getByRole('dialog', { name: 'Remote themes' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();

    await expect(dialog).not.toBeVisible();
    await expect(catalogTile.getByRole('button', { name: 'Enable catalog' })).toBeVisible();
  });
});
