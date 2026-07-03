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

  test('draws an inset ring (not clipped) for a focusable element flush inside a CutoutCard-style overflow:hidden container', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    // Regression coverage for a post-merge review finding on #514
    // (Codex comment_id=3515157099): the broad selector list above draws its
    // ring with a *positive* `outlineOffset` (2px outside the border box).
    // That's invisible/clipped whenever the focused element sits flush (no
    // padding) inside an `overflow: hidden` ancestor — concretely,
    // `CutoutCard` (`src/app/components/cutout-card/CutoutCard.css.ts`,
    // `overflow: 'hidden'`, no padding) wrapping `MenuItem` rows directly, as
    // in `AccountData.tsx` and `DevelopTools.tsx`.
    //
    // This synthesizes that exact shape: a container carrying a class name
    // containing `CutoutCard` with `overflow: hidden` and zero padding, and
    // a `[class*="MenuItem"]`-classed button flush against its edge. The
    // container also carries `data-focus-ring-inset`, the marker attribute
    // `CutoutCard` (`src/app/components/cutout-card/CutoutCard.tsx`) sets
    // when its call site opts in via the `unpadded` prop — as
    // `AccountData.tsx`/`DevelopTools.tsx` do for exactly this flush shape.
    // The selector targets that marker attribute rather than the class name
    // alone (see the follow-up fix below for why: a bare `[class*="CutoutCard"]`
    // match is too broad and also matches padded `CutoutCard` instances that
    // were never at clipping risk, incorrectly forcing the inset ring on
    // them too — comment_id=3515284845). Real `CutoutCard`/`MenuItem` usage
    // can't easily be driven through this login-page smoke harness (it
    // requires an authenticated session, a space, and developer tools
    // enabled), so this exercises the shipped selector/CSS directly instead
    // of the full component tree.
    const ids = await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'cutout-card-smoke-test';
      container.className = 'CutoutCard_CutoutCard__smoketest';
      container.setAttribute('data-focus-ring-inset', '');
      Object.assign(container.style, {
        overflow: 'hidden',
        border: '2px solid black',
        borderRadius: '8px',
        width: '200px',
        padding: '0',
        margin: '40px',
      });

      const menuItem = document.createElement('button');
      menuItem.id = 'cutout-card-menuitem-smoke-test';
      menuItem.className = 'MenuItem_MenuItem__smoketest';
      menuItem.textContent = 'Add New';
      Object.assign(menuItem.style, {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px',
        margin: '0',
        border: 'none',
      });

      container.appendChild(menuItem);
      document.body.appendChild(container);

      return { containerId: container.id, menuItemId: menuItem.id };
    });

    const container = page.locator(`#${ids.containerId}`);
    const menuItem = page.locator(`#${ids.menuItemId}`);

    await menuItem.focus();
    await expect(menuItem).toBeFocused();

    const result = await menuItem.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        // Negative offset draws the ring *inside* the border box instead of
        // outside it, so it can't be cropped by the ancestor's
        // `overflow: hidden`.
        outlineOffset: style.outlineOffset,
      };
    });

    expect(result.outlineStyle).toBe('solid');
    expect(result.outlineWidth).toBe('2px');
    expect(result.outlineOffset).toBe('-2px');

    // Belt-and-suspenders: also assert geometrically that the ring (element
    // box minus the negative offset) stays within the clipping container's
    // box, i.e. nothing would actually be cropped.
    const containerBox = await container.boundingBox();
    const menuItemBox = await menuItem.boundingBox();
    expect(containerBox).not.toBeNull();
    expect(menuItemBox).not.toBeNull();

    if (containerBox && menuItemBox) {
      // outlineOffset is negative (ring inset), so the ring never extends
      // beyond the focused element's own box, which itself is inside the
      // container (flush on left/right/bottom, per this layout).
      expect(menuItemBox.x).toBeGreaterThanOrEqual(containerBox.x);
      expect(menuItemBox.y).toBeGreaterThanOrEqual(containerBox.y);
      expect(menuItemBox.x + menuItemBox.width).toBeLessThanOrEqual(
        containerBox.x + containerBox.width + 0.5
      );
      expect(menuItemBox.y + menuItemBox.height).toBeLessThanOrEqual(
        containerBox.y + containerBox.height + 0.5
      );
    }
  });

  test('keeps the normal outset ring for a focusable element inside a padded CutoutCard, not the inset treatment', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/login\/smoke\.test\/?$/);

    // Regression coverage for the Sentry LOW-severity finding on this PR
    // (comment_id=3515284845): the `[class*="CutoutCard"]`-scoped inset rule
    // above matched ANY element with `CutoutCard` in its class name,
    // regardless of whether that specific instance actually had padding.
    // Several real call sites give their focusable children real buffer via
    // an inline `style={{ padding: ... }}` (e.g. `UserModeration.tsx`'s
    // ban/kick/invite alerts, `RoomAddress.tsx`'s published-addresses list)
    // and were never at clipping risk — forcing the inset ring on them can
    // pull the ring inside the focused element's own content instead of
    // drawing it cleanly outside.
    //
    // `CutoutCard` (`src/app/components/cutout-card/CutoutCard.tsx`) now
    // only sets the `data-focus-ring-inset` marker attribute the CSS rule
    // targets when the call site explicitly opts in via the `unpadded`
    // prop (used only by the genuinely flush/clipping-risk instances in
    // `AccountData.tsx`/`DevelopTools.tsx`). This synthesizes a *padded*
    // `CutoutCard`-shaped container — same `overflow: hidden` clipping,
    // same `[class*="CutoutCard"]`-matching class name, but WITHOUT the
    // `data-focus-ring-inset` marker and WITH real padding — to prove its
    // focusable child keeps the app-wide default outset ring instead.
    const ids = await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'cutout-card-padded-smoke-test';
      container.className = 'CutoutCard_CutoutCard__smoketest';
      Object.assign(container.style, {
        overflow: 'hidden',
        border: '2px solid black',
        borderRadius: '8px',
        width: '200px',
        padding: '12px',
        margin: '40px',
        boxSizing: 'border-box',
      });

      const button = document.createElement('button');
      button.id = 'cutout-card-padded-button-smoke-test';
      button.textContent = 'Unban';
      Object.assign(button.style, {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        border: 'none',
      });

      container.appendChild(button);
      document.body.appendChild(container);

      return { containerId: container.id, buttonId: button.id };
    });

    const button = page.locator(`#${ids.buttonId}`);

    await button.focus();
    await expect(button).toBeFocused();

    const result = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset,
      };
    });

    expect(result.outlineStyle).toBe('solid');
    expect(result.outlineWidth).toBe('2px');
    // Positive offset (the app-wide default), NOT the `-2px` inset
    // treatment — this padded container never opted into
    // `data-focus-ring-inset`, so the ring draws normally outside the
    // button's border box like everywhere else in the app.
    expect(result.outlineOffset).toBe('2px');
  });
});
