import { globalStyle } from '@vanilla-extract/css';

// Ensure the safe-area padding areas on #root (top/bottom on iOS) show
// the app's background container color instead of the white body fallback.
// Without this, the 34px home-indicator gap at the bottom is visibly white
// against the gray content, making it look like a UI gap on iOS PWA.
globalStyle('#root', {
  backgroundColor: 'var(--sable-bg-container)',
});

// WCAG 2.4.7 Focus Visible: app-wide keyboard focus indicator.
//
// `folds` (our design system) ships a `FocusOutline` atom class, but it is
// opt-in per component and most interactive elements never apply it. Some
// of folds' own base components (e.g. `Input`'s inner `<input>`, the
// message-editor textarea) go further and explicitly set `outline: none`
// on `:focus`, relying on a low-contrast `box-shadow`/`border-color` cue
// on a wrapper element instead of a real outline. Net effect: keyboard
// users tabbing through the app get no visible indication of focus on
// most buttons, links, and inputs.
//
// This is a single global override rather than per-component patches.
// `:focus-visible` (not `:focus`) is used so that, per the CSS spec's
// heuristics, mouse/touch activation generally does not show the ring in
// most browsers — only keyboard/programmatic focus does. This isn't an
// absolute cross-browser guarantee (`:focus-visible` heuristics for text
// inputs in particular can still match on a mouse click in some browsers),
// but it's a strict improvement over `:focus`. `--sable-primary-main` is
// the app's theme-adaptive primary accent (defined for both light and dark
// themes, and swapped by custom theme catalogs), so the ring keeps
// sufficient contrast against either background rather than relying on a
// hardcoded color that could disappear on one theme.
//
// `[role="textbox"]` covers the Slate `<Editable>` message composer/editor
// (see `src/app/components/editor/Editor.tsx`, which renders
// `role="textbox"` when not read-only): `Editor.css.ts` explicitly zeroes
// the native outline on `&:focus`, so without this the single most-used
// interactive surface in the app would have no visible focus indicator.
//
// `[tabindex="0"]` (rather than the broader `[tabindex]`) intentionally
// excludes `tabindex="-1"` elements, which are only programmatically
// focusable and not real keyboard tab-stops. Note this still matches some
// non-interactive scroll/reading containers that use `tabIndex={0}` purely
// to make overflowing content keyboard-scrollable (e.g.
// `src/app/features/settings/general/General.tsx`) — those pick up a
// focus ring that can look like a misleading "this is clickable" cue.
// Fixing that fully requires marking those containers distinctly in their
// component code (e.g. `role="group"` or a dedicated class) since there is
// no CSS-only way to tell them apart from genuinely-interactive
// `tabIndex={0}` elements that have no other role/class (e.g.
// `src/app/features/lobby/RoomItem.tsx`); tracked as a follow-up rather
// than done here to avoid scope-creeping this global CSS fix into
// per-component changes.
//
// All three blocks are scoped under `body:not(.sable-a11y-highlights-disabled)`
// so the rings are ON by default (matching pre-existing app-wide behaviour,
// including on unauthenticated routes like /login that never mount any
// settings-driven feature) and are only suppressed once the user turns off
// the Focus Highlights setting (Settings > General > Accessibility). This
// opt-out shape means the default case needs no JS to take effect (no
// first-paint flash) and unauthenticated routes, which have no settings UI
// and never toggle the class, simply keep the default rings. The disabled
// class is toggled by AuthRouteThemeManager in ThemeManager.tsx, in the same
// effect that already resets `document.body.className` for theme/motion/
// underline-link settings, so the class survives those resets.
globalStyle(
  `
    body:not(.sable-a11y-highlights-disabled) a:focus-visible,
    body:not(.sable-a11y-highlights-disabled) button:focus-visible,
    body:not(.sable-a11y-highlights-disabled) select:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="button"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="tab"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="menuitem"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="option"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="checkbox"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="radio"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="switch"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [role="textbox"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [tabindex="0"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [class*="Button"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [class*="Chip"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [class*="MenuItem"]:focus-visible,
    body:not(.sable-a11y-highlights-disabled) [class*="IconButton"]:focus-visible
`,
  {
    outline: '2px solid var(--sable-primary-main) !important',
    outlineOffset: '2px !important',
  }
);

// `input`/`textarea` need special handling, split out from the selector list
// above, to avoid a double-ring artifact (Sentry comment_id=3514683656) on
// folds' `Input` component.
//
// folds' `Input` renders a wrapper `<div>` around a plain inner `<input>`,
// explicitly zeroes the native outline on that inner input via `:focus`, and
// instead shows its own low-contrast, non-`:focus-visible`-gated box-shadow
// cue on the wrapper. The rule below this one gives that wrapper div a real
// ring. If the direct-element rule *also* matched the inner `<input>`, a
// focused folds `Input` would show two concentric rings (one tight around
// the `<input>`, one around the padded wrapper `<div>`) instead of one.
//
// folds' generated class names are content hashes (e.g. `_1rrvnjmr`) with no
// stable, human-readable substring to select on across folds versions/dev
// vs. prod builds — confirmed empirically that the `[class*="Button"]`-style
// substring selectors above don't actually match folds' shipped classes in
// this build (folds is prebuilt with its own vanilla-extract identifier
// mode, independent of this app's `identifiers: 'debug'` vite config). So
// instead of trying to positively match folds' wrapper, this repo's own raw
// `<input>`/`<textarea>` elements that (a) are NOT folds' `Input`/`TextArea`
// and (b) explicitly suppress their own native outline (relying entirely on
// this override for any visible ring at all) opt back in to the direct-ring
// behavior via `data-focus-ring-self`. See e.g.
// `src/app/components/user-profile/UserChips.tsx`,
// `src/app/features/room/message/MessageOptionsMenu.tsx`,
// `src/app/components/message/modals/Options.tsx` (nickname-edit inputs,
// each a direct child of a plain `Box`/div wrapper), and
// `src/app/components/image-viewer/ImageViewer.tsx` (zoom input, uses
// `all: unset`). Any *other* raw input/textarea that is not a direct child
// of a `<div>` (e.g. ImageViewer's, whose parent is a `<span>`) is
// unaffected either way and always gets its own ring from this rule.
globalStyle(
  `
    body:not(.sable-a11y-highlights-disabled) input:focus-visible:not(div > input),
    body:not(.sable-a11y-highlights-disabled) textarea:focus-visible:not(div > textarea),
    body:not(.sable-a11y-highlights-disabled) div > input:focus-visible[data-focus-ring-self],
    body:not(.sable-a11y-highlights-disabled) div > textarea:focus-visible[data-focus-ring-self]
`,
  {
    outline: '2px solid var(--sable-primary-main) !important',
    outlineOffset: '2px !important',
  }
);

// folds' `Input` wrapper renders its own focus cue as a `box-shadow` on the
// wrapper div when the inner `<input>`/`<textarea>` is focused (via
// `:has(input:focus)` / `:focus-within`), and explicitly zeroes the native
// outline on the input itself. That box-shadow is low-contrast in practice
// (a subtle border-color swap) and is not driven by `:focus-visible`, so it
// still fires on mouse clicks and can be invisible depending on the
// surrounding container. Give the wrapper a real, theme-adaptive ring too
// whenever the input inside it currently has keyboard focus — but only when
// the input isn't already getting its own direct ring from the rule above
// (`data-focus-ring-self`), otherwise a raw input that happens to sit
// directly inside a `Box`/div (e.g. the nickname-edit inputs) would get a
// second ring on its wrapper on top of its own, recreating the same
// double-ring bug for a different pairing of elements.
globalStyle(
  `
    body:not(.sable-a11y-highlights-disabled) div:has(> input:focus-visible:not([data-focus-ring-self])),
    body:not(.sable-a11y-highlights-disabled) div:has(> textarea:focus-visible:not([data-focus-ring-self]))
`,
  {
    outline: '2px solid var(--sable-primary-main) !important',
    outlineOffset: '2px !important',
  }
);

globalStyle(
  `
    button, 
    [role="button"], 
    [class*="Button"], 
    [class*="Chip"], 
    [class*="MenuItem"]
`,
  {
    transition: 'transform 0.1s ease-in-out, background-color 0.15s ease !important',
  }
);

globalStyle(
  `
    button:active, 
    [role="button"]:active, 
    [class*="Button"]:active, 
    [class*="Chip"]:active
`,
  {
    transform: 'scale(0.96) !important',
  }
);

globalStyle(
  `
    button:hover, 
    [role="button"]:hover
`,
  {
    transform: 'translateY(-1px)',
  }
);

globalStyle(
  `
    button[class*="_1684mq51"]:has(img):hover,
    [data-index] button:hover,
    [data-index] [role="button"]:hover
`,
  {
    transform: 'none !important',
  }
);

globalStyle(
  'button[data-no-button-motion], button[data-no-button-motion]:hover, button[data-no-button-motion]:active',
  {
    transform: 'none !important',
    transition: 'none !important',
  }
);
