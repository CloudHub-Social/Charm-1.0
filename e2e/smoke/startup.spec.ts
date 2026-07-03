import { expect, test } from '@playwright/test';
import { installSmokeApp, seedLaunchContext, seedStoredSession } from './smokeApp';
import { captureSnapshot } from './snapshot';

test.describe('app startup smoke', () => {
  test('retries config.json during startup and still reaches login', async ({ page }, testInfo) => {
    const smokeApp = await installSmokeApp(page, { configFailuresBeforeSuccess: 2 });

    await page.goto('/');

    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);
    // `exact: true` avoids matching Sentry's own dev-toolbar "Login to
    // Sentry" button, which also satisfies a non-exact { name: 'Login' }
    // role query when VITE_SENTRY_TOOLBAR is enabled (as it is in the
    // Sentry Snapshots CI job, but not in a bare local run).
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
    expect(smokeApp.getConfigRequestCount()).toBe(3);
    await captureSnapshot(page, testInfo, 'real-routes/login');
  });

  test('normalizes hash-router login tokens into the routed login URL', async ({ page }) => {
    await installSmokeApp(page);

    await page.goto('/?loginToken=smoke-token#/login/smoke.test/');

    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?\?loginToken=smoke-token$/);
  });

  test('preserves unauthenticated deep-link redirects for /to routes', async ({ page }) => {
    await installSmokeApp(page);

    const deepLink =
      '/#/to/%40alice%3Asmoke.test/%21room%3Asmoke.test/%24event%3Asmoke.test?joinCall=true';

    await page.goto(deepLink);

    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('after_login_redirect_url')))
      .toBe('/to/%40alice%3Asmoke.test/%21room%3Asmoke.test/%24event%3Asmoke.test?joinCall=true');
  });

  test('restores a stored session into the home route before client init completes', async ({
    page,
  }, testInfo) => {
    await installSmokeApp(page);
    await seedStoredSession(page);

    await page.goto('/');

    await expect(page).toHaveURL(/#\/home\/?$/);
    await expect(page.getByText('Petting cats')).toBeVisible();
    await captureSnapshot(page, testInfo, 'real-routes/home-restored-session');
  });

  test('keeps authenticated notification restore routes out of the login flow', async ({
    page,
  }) => {
    await installSmokeApp(page);
    await seedStoredSession(page);

    await page.goto(
      '/#/to/%40smoke%3Asmoke.test/%21room%3Asmoke.test/%24event%3Asmoke.test?joinCall=true'
    );

    await expect(
      page,
      'stored sessions should keep /to notification restore inside the authenticated boot path'
    ).toHaveURL(
      /#\/to\/%40smoke%3Asmoke\.test\/%21room%3Asmoke\.test\/%24event%3Asmoke\.test\?joinCall=true$/
    );
    await expect(page.getByText('Petting cats')).toBeVisible();
  });

  test('recovers a persisted notification launch target during bootstrap', async ({
    page,
  }, testInfo) => {
    // Skipped on `mobile-ios` (WebKit) only -- confirmed via isolated
    // diagnostics that this is a Playwright/WebKit test-environment
    // limitation, not an app bug: a bare `cache.put()` followed by
    // `page.reload()` loses the Cache Storage entry under this project even
    // with the app's service worker completely blocked via `page.route()`
    // (the cache *container* still shows up in `caches.keys()`, but the
    // entry inside it is gone). The original hypothesis here was a router
    // race between the async launch-context check and the default
    // "restore session -> home" redirect; that race was real and has been
    // fixed (see `recoverNotificationLaunchPath` in
    // `notificationLaunchRecovery.ts`, now awaited by the router's index
    // loader instead of firing a `window.location.replace()` after the
    // fact) -- this test now passes on `chromium` and `mobile-android`.
    // What's left failing on `mobile-ios` is unrelated to that fix and
    // looks like it needs verifying against a production build (this repo
    // runs the dev server with `devOptions.enabled: true` for e2e) and/or
    // real Safari before concluding whether it's a real production risk.
    test.skip(
      testInfo.project.name === 'mobile-ios',
      'Playwright-WebKit Cache Storage does not survive page.reload() in this test environment, see comment above'
    );
    await installSmokeApp(page);
    await seedStoredSession(page);
    await seedLaunchContext(
      page,
      'http://127.0.0.1:4173/#/to/%40smoke%3Asmoke.test/%21room%3Asmoke.test/%24event%3Asmoke.test'
    );

    await page.goto('/');

    await expect(page).toHaveURL(
      /#\/to\/%40smoke%3Asmoke\.test\/%21room%3Asmoke\.test\/%24event%3Asmoke\.test$/
    );
  });

  test('preserves a persisted notification launch target across login for a logged-out cold start', async ({
    page,
  }, testInfo) => {
    // Regression coverage for a real bug an automated reviewer caught:
    // recoverNotificationLaunchPath() was only being awaited inside the
    // router's `hasStoredSession()` branch, so a logged-out cold start never
    // consumed the persisted launch context at all -- the notification
    // target was silently dropped instead of becoming the post-login
    // redirect.
    test.skip(
      testInfo.project.name === 'mobile-ios',
      'Known Playwright-WebKit Cache Storage limitation, see the test above'
    );
    await installSmokeApp(page);
    await seedLaunchContext(
      page,
      'http://127.0.0.1:4173/#/to/%40smoke%3Asmoke.test/%21room%3Asmoke.test/%24event%3Asmoke.test'
    );

    await page.goto('/');

    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('after_login_redirect_url')))
      .toBe('/to/%40smoke%3Asmoke.test/%21room%3Asmoke.test/%24event%3Asmoke.test');
  });
});
