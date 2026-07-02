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
// `:focus-visible` (not `:focus`) is used so mouse/touch activation never
// shows the ring — only keyboard/programmatic focus does. `--sable-primary-main`
// is the app's theme-adaptive primary accent (defined for both light and
// dark themes, and swapped by custom theme catalogs), so the ring keeps
// sufficient contrast against either background rather than relying on a
// hardcoded color that could disappear on one theme.
globalStyle(
  `
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible,
    select:focus-visible,
    [role="button"]:focus-visible,
    [role="tab"]:focus-visible,
    [role="menuitem"]:focus-visible,
    [role="option"]:focus-visible,
    [role="checkbox"]:focus-visible,
    [role="radio"]:focus-visible,
    [role="switch"]:focus-visible,
    [tabindex]:focus-visible,
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

// folds' `Input` wrapper renders its own focus cue as a `box-shadow` on the
// wrapper div when the inner `<input>`/`<textarea>` is focused (via
// `:has(input:focus)` / `:focus-within`), and explicitly zeroes the native
// outline on the input itself. That box-shadow is low-contrast in practice
// (a subtle border-color swap) and is not driven by `:focus-visible`, so it
// still fires on mouse clicks and can be invisible depending on the
// surrounding container. Give the wrapper a real, theme-adaptive ring too
// whenever the input inside it currently has keyboard focus.
globalStyle('div:has(> input:focus-visible), div:has(> textarea:focus-visible)', {
  outline: '2px solid var(--sable-primary-main) !important',
  outlineOffset: '2px !important',
});

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
