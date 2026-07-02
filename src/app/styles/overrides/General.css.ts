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
globalStyle(
  `
    a:focus-visible,
    button:focus-visible,
    select:focus-visible,
    [role="button"]:focus-visible,
    [role="tab"]:focus-visible,
    [role="menuitem"]:focus-visible,
    [role="option"]:focus-visible,
    [role="checkbox"]:focus-visible,
    [role="radio"]:focus-visible,
    [role="switch"]:focus-visible,
    [role="textbox"]:focus-visible,
    [tabindex="0"]:focus-visible,
    [class*="Button"]:focus-visible,
    [class*="Chip"]:focus-visible,
    [class*="MenuItem"]:focus-visible,
    [class*="IconButton"]:focus-visible
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
    input:focus-visible:not(div > input),
    textarea:focus-visible:not(div > textarea),
    div > input:focus-visible[data-focus-ring-self],
    div > textarea:focus-visible[data-focus-ring-self]
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
    div:has(> input:focus-visible:not([data-focus-ring-self])),
    div:has(> textarea:focus-visible:not([data-focus-ring-self]))
`,
  {
    outline: '2px solid var(--sable-primary-main) !important',
    outlineOffset: '2px !important',
  }
);

// Codex post-merge review of #514 (comment_id=3515157099) flagged that the
// global rules above use a *positive* `outlineOffset` (`2px`, drawn outside
// the element's border box), which gets silently clipped whenever the
// focused element sits flush (no padding) inside an `overflow: hidden`
// ancestor — the ring is cropped on whichever edges touch the container
// boundary. Confirmed concretely: `CutoutCard` (`src/app/components/
// cutout-card/CutoutCard.css.ts`) sets `overflow: 'hidden'` with zero
// padding, and both `AccountData.tsx` and `DevelopTools.tsx` render
// `MenuItem` rows as its direct children with no gap, so a keyboard-focused
// row loses its ring on the edges flush against the card.
//
// This is not a one-off: it recurs anywhere a component both clips overflow
// and butts focusable children flush against its edge. Rather than patch
// each call site, `CutoutCard`'s own class is targeted directly here (its
// vanilla-extract debug identifier — this app builds with `identifiers:
// 'debug'` — keeps a stable `CutoutCard` substring, unlike folds' prebuilt
// classes; see the `[class*="Button"]`-style comment above for why that
// substring approach doesn't work for folds' own classes). Any current or
// future `CutoutCard` usage is covered automatically, with no per-call-site
// opt-in needed, since every `CutoutCard` clips overflow by construction.
//
// The global *positive* offset is intentionally left unchanged for
// everywhere else: it reads clearly against non-clipping backgrounds, and
// flipping it negative app-wide would draw the ring on top of/inside
// content everywhere, a worse look for the common (non-clipped) case.
globalStyle(
  `
    [class*="CutoutCard"] a:focus-visible,
    [class*="CutoutCard"] button:focus-visible,
    [class*="CutoutCard"] select:focus-visible,
    [class*="CutoutCard"] [role="button"]:focus-visible,
    [class*="CutoutCard"] [role="tab"]:focus-visible,
    [class*="CutoutCard"] [role="menuitem"]:focus-visible,
    [class*="CutoutCard"] [role="option"]:focus-visible,
    [class*="CutoutCard"] [role="checkbox"]:focus-visible,
    [class*="CutoutCard"] [role="radio"]:focus-visible,
    [class*="CutoutCard"] [role="switch"]:focus-visible,
    [class*="CutoutCard"] [role="textbox"]:focus-visible,
    [class*="CutoutCard"] [tabindex="0"]:focus-visible,
    [class*="CutoutCard"] [class*="Button"]:focus-visible,
    [class*="CutoutCard"] [class*="Chip"]:focus-visible,
    [class*="CutoutCard"] [class*="MenuItem"]:focus-visible,
    [class*="CutoutCard"] [class*="IconButton"]:focus-visible
`,
  {
    outlineOffset: '-2px !important',
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
