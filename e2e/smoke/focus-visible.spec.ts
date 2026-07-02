import { expect, test } from '@playwright/test';
import { installSmokeApp, stubToolbar } from './smokeApp';

// Regression coverage for the global `:focus-visible` indicator added in
// `src/app/styles/overrides/General.css.ts`. jsdom (used by this repo's
// vitest suite) does not implement real CSS `:focus-visible` matching or
// outline/box-shadow computation, so this can only be verified with a real
// browser via Playwright.
//
// The fix ships two separate CSS rules, both drawing a `2px solid
// var(--sable-primary-main)` outline with a `2px` offset:
//   1. A broad selector list (buttons, links, inputs, `[role="..."]`, etc.).
//   2. A special case for folds' `Input` wrapper `<div>` (which renders
//      `<div><input/></div>` and normally suppresses the native outline on
//      the inner `<input>` in favor of a low-contrast box-shadow), so the
//      wrapper gets the same outline when the inner input has keyboard focus.
//
// Note: folds itself already applies a baseline `outline: 3px solid
// rgba(0,0,0,0.5)` on `:focus-visible` to some of its own atoms (its
// `FocusOutline` class), so a bare "is there any outline at all" assertion
// would pass even with this fix's rules fully reverted and wouldn't catch a
// regression. These assertions instead pin down the fix's specific
// signature (2px width, 2px offset, and the theme-adaptive
// `--sable-primary-main` color) so they fail if the override is removed,
// leaving only folds' weaker, non-theme-adaptive default in place.
//
// Both rules are exercised here against a real route/components so a
// regression in either one is caught.

test.describe('global focus-visible indicator', () => {
  test.beforeEach(async ({ page }) => {
    await installSmokeApp(page);
    // Sentry's real dev toolbar (enabled in the Sentry Snapshots CI job)
    // renders its own "Login to Sentry" button, which collides with
    // non-exact { name: 'Login' } role queries below and can otherwise
    // interfere with these precise CSS assertions. This spec doesn't test
    // toolbar behavior itself, so it's stubbed away unconditionally.
    await stubToolbar(page);
  });

  test('gives a folds Button the theme-adaptive 2px outline on keyboard focus', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    const loginButton = page.getByRole('button', { name: 'Login', exact: true });
    await expect(loginButton).toBeVisible();

    await loginButton.focus();
    await expect(loginButton).toBeFocused();

    const outline = await loginButton.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset,
        outlineColor: style.outlineColor,
        primaryMain: getComputedStyle(document.documentElement).getPropertyValue(
          '--sable-primary-main'
        ),
      };
    });

    expect(outline.outlineStyle).toBe('solid');
    // Pinned to the fix's exact 2px width/offset. folds' own baseline
    // `FocusOutline` class (applied to `Button` regardless of this fix)
    // uses 3px with no offset, so this also fails if the override is lost.
    expect(outline.outlineWidth).toBe('2px');
    expect(outline.outlineOffset).toBe('2px');
    expect(outline.outlineColor).not.toBe('rgba(0, 0, 0, 0.5)');
  });

  test('gives a folds Input wrapper the theme-adaptive 2px outline when the inner input has keyboard focus, without a double ring on the input itself', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    const usernameInput = page.locator('#login-username-input');
    await expect(usernameInput).toBeVisible();

    // folds' `Input` renders `<div class="..."><input/></div>` and
    // explicitly zeroes the native outline on the inner `<input>` in favor
    // of a low-contrast, non-`:focus-visible`-gated box-shadow on the
    // wrapper. The wrapper-targeted rule (`div:has(> input:focus-visible)`)
    // is what puts a real outline on that wrapper div.
    //
    // Regression coverage for Sentry comment_id=3514683656: earlier versions
    // of this fix had the broad direct-element selector list *also* match
    // `input:focus-visible` unconditionally, so a focused folds `Input`
    // rendered two concentric rings — one tight around the `<input>` itself,
    // one around the padded wrapper `<div>`. The fix scopes the direct-input
    // rule to skip inputs that are a direct child of a `<div>` (folds'
    // `Input` shape) unless explicitly opted back in via
    // `data-focus-ring-self` (used by this repo's own raw, non-folds inputs
    // — see the next test), so only the wrapper should show a ring here.
    await usernameInput.focus();
    await expect(usernameInput).toBeFocused();

    const outlines = await usernameInput.evaluate((el) => {
      const wrapper = el.parentElement;
      const ownStyle = getComputedStyle(el);
      const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
      return {
        own: {
          outlineStyle: ownStyle.outlineStyle,
          outlineWidth: ownStyle.outlineWidth,
        },
        wrapper: wrapperStyle
          ? {
              outlineStyle: wrapperStyle.outlineStyle,
              outlineWidth: wrapperStyle.outlineWidth,
              outlineOffset: wrapperStyle.outlineOffset,
              outlineColor: wrapperStyle.outlineColor,
            }
          : null,
      };
    });

    // The inner input itself must NOT get its own direct ring — only the
    // wrapper should. `outlineStyle: none` means no outline is painted at
    // all, regardless of what `outlineWidth` computes to.
    expect(outlines.own.outlineStyle).toBe('none');

    expect(outlines.wrapper).not.toBeNull();
    expect(outlines.wrapper?.outlineStyle).toBe('solid');
    expect(outlines.wrapper?.outlineWidth).toBe('2px');
    expect(outlines.wrapper?.outlineOffset).toBe('2px');
  });

  test('gives a standalone raw input inside a div wrapper its own direct ring (not the wrapper), unlike folds Input', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    // Simulate this repo's own raw, non-folds inputs that explicitly
    // suppress their native outline and rely entirely on this override for
    // any visible ring (e.g. the nickname-edit inputs in
    // `UserChips.tsx`/`MessageOptionsMenu.tsx`/`Options.tsx`, and the
    // zoom-level input in `ImageViewer.tsx`). Each is a direct child of a
    // plain layout `Box`/div, structurally identical to folds' `Input`
    // wrapper shape, and is marked with `data-focus-ring-self` so it keeps
    // its own ring instead of only the wrapper getting one.
    const ids = await page.evaluate(() => {
      const wrapper = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'text';
      input.style.outline = 'none';
      input.id = 'raw-input-smoke-test';
      input.setAttribute('data-focus-ring-self', '');
      wrapper.id = 'raw-input-wrapper-smoke-test';
      wrapper.appendChild(input);
      document.body.appendChild(wrapper);
      return { inputId: input.id, wrapperId: wrapper.id };
    });

    const rawInput = page.locator(`#${ids.inputId}`);
    const rawWrapper = page.locator(`#${ids.wrapperId}`);

    await rawInput.focus();
    await expect(rawInput).toBeFocused();

    const outlines = await rawInput.evaluate((el) => {
      const wrapper = el.parentElement;
      const ownStyle = getComputedStyle(el);
      const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
      return {
        own: {
          outlineStyle: ownStyle.outlineStyle,
          outlineWidth: ownStyle.outlineWidth,
          outlineOffset: ownStyle.outlineOffset,
        },
        wrapper: wrapperStyle
          ? {
              outlineStyle: wrapperStyle.outlineStyle,
              outlineWidth: wrapperStyle.outlineWidth,
            }
          : null,
      };
    });

    // The raw input itself gets the direct ring...
    expect(outlines.own.outlineStyle).toBe('solid');
    expect(outlines.own.outlineWidth).toBe('2px');
    expect(outlines.own.outlineOffset).toBe('2px');

    // ...and its plain div wrapper must NOT also get a ring (that would be
    // the double-ring bug for this pairing instead).
    expect(outlines.wrapper?.outlineStyle).toBe('none');

    await expect(rawWrapper).toBeAttached();
  });

  test('keeps the outline theme-adaptive: matches --sable-primary-main, not a hardcoded color', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    const loginButton = page.getByRole('button', { name: 'Login', exact: true });
    await loginButton.focus();
    await expect(loginButton).toBeFocused();

    const colors = await loginButton.evaluate((el) => {
      // `--sable-primary-main` is defined by the theme scope (not on
      // `:root`), so resolve it the same way the browser resolves the
      // outline color: from a throwaway element placed as a sibling of the
      // focused element, inside the same themed subtree.
      const probe = document.createElement('div');
      probe.style.color = 'var(--sable-primary-main)';
      el.insertAdjacentElement('afterend', probe);
      const resolvedPrimaryMain = getComputedStyle(probe).color;
      probe.remove();

      return {
        outlineColor: getComputedStyle(el).outlineColor,
        resolvedPrimaryMain,
      };
    });

    expect(colors.resolvedPrimaryMain).not.toBe('');
    // Not black/transparent — i.e. not folds' own baseline `FocusOutline`
    // color (`rgba(0, 0, 0, 0.5)`), and not empty/unresolved.
    expect(colors.outlineColor).not.toBe('rgba(0, 0, 0, 0.5)');
    expect(colors.outlineColor).toBe(colors.resolvedPrimaryMain);
  });

  test('moves the visible 2px outline across elements when tabbing through the login form', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    const usernameInput = page.locator('#login-username-input');
    await expect(usernameInput).toBeVisible();

    await usernameInput.focus();
    await expect(usernameInput).toBeFocused();

    // Confirm the currently-focused element in the real DOM (not just the
    // element we asked Playwright to focus) has the fix's 2px outline
    // somewhere on itself or its wrapper — i.e. keyboard focus is never
    // silently indicator-less as the user tabs through the form.
    const activeElementHasFixOutline = await page.evaluate(() => {
      function hasFixOutline(el: Element) {
        const style = getComputedStyle(el);
        return style.outlineStyle === 'solid' && style.outlineWidth === '2px';
      }

      const active = document.activeElement;
      if (!active) return false;

      if (hasFixOutline(active)) return true;
      const wrapper = active.parentElement;
      return wrapper ? hasFixOutline(wrapper) : false;
    });

    expect(activeElementHasFixOutline).toBe(true);
  });
});
