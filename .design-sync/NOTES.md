# Design Sync Notes — Charm / folds

## Setup

- Primary package: `folds` v2.6.2 from `cinnyapp/folds` (pre-built dist already in node_modules)
- Charm is an app repo, not a library — folds is a third-party DS dep
- Node version: `~/.nvm/versions/node/v24.14.0/bin/node` (matches .nvmrc v24.14.0)
- pnpm and node functions in interactive zsh recurse infinitely — always use absolute binary paths
- Converter deps installed at `.ds-sync/`
- Playwright 1.61.0 installed (matches Charm's pinned version); Chromium at `~/Library/Caches/ms-playwright/chromium-1228`

## CRITICAL: dts entry resolution fork

- folds ships `.d.ts` under `dist/` but declares **no `types` field** in package.json (and empty `exports`). The converter's `projectFor` resolves the dts entry to `pkgDir/index.d.ts` (non-existent) → `getSourceFile` returns null → **ZERO_MATCH, 0 components**.
- Fixed with TWO forks under `.design-sync/overrides/`:
  - `dts.mjs`: entry falls back to `typesRoot/index.d.ts` when the package.json-derived entry doesn't exist
  - `source-kit.mjs`: its static `import './dts.mjs'` would otherwise use the UNFORKED lib copy; forked to repoint at the local forked dts (common/bundle imports repointed to `../../.ds-sync/lib/`)
- Both declared in `cfg.libOverrides`. On re-sync, diff both against the bundled `lib/*.mjs` and merge upstream changes.
- **Do NOT run the build against the symlinked worktree `node_modules`** — ts-morph normalizes source paths to realpath, so `getSourceFile(entry)` misses via a symlink. Always pass real paths: `--node-modules /Users/evie/git/Charm/node_modules --entry /Users/evie/git/Charm/node_modules/folds/dist/index.js`

## Build command (exact)

```
cd <worktree> && PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright \
  ~/.nvm/versions/node/v24.14.0/bin/node .ds-sync/package-build.mjs \
  --config .design-sync/config.json \
  --node-modules /Users/evie/git/Charm/node_modules \
  --entry /Users/evie/git/Charm/node_modules/folds/dist/index.js --out ./ds-bundle
```

## Config path resolution (learned the hard way)

- `cfg.cssEntry` is resolved **relative to PKG_DIR** (the folds package dir), bounded to PKG_DIR → use `dist/style.css`, NOT `node_modules/folds/...`
- `cfg.extraFonts` resolved relative to PKG_DIR, bounded to workspaceRoot (Charm git repo) → sibling fontsource packages are `../@fontsource-variable/nunito/index.css` (up one from folds to node_modules, then to sibling)

## Non-component exports excluded (componentSrcMap: null)

folds exports several PascalCase values that are NOT visual components:
- `string` (CSS class names): DefaultReset, TextReset, Disabled, FocusOutline, OverlayBackdrop
- `Record` (icon registry): Icons
- `React.Provider` (context, no visual): OverlayContainerProvider, PopOutContainerProvider, TooltipContainerProvider
- Portal (renders into a DOM portal, can't show in a card)
- KEPT (renderable): TooltipProvider, OverlayCenter, plus the 27 real components

## Theme fidelity: folds default vs Charm purple (IMPORTANT)

- Current provider applies folds' DEFAULT light theme class `oq6d071w` → components render in folds' stock palette (BLUE primary #1858D5), NOT Charm's PURPLE (#6e56cf).
- Charm's brand purple comes from `src/colors.css.ts`: `createTheme(color, sableThemeMapping)` — a vanilla-extract theme that remaps folds' color vars to `var(--sable-*)` values (defined in `src/app/styles/themes.css`).
- Getting the exact Charm class requires COMPILING colors.css.ts (needs Charm's full vite/vanilla-extract build) — not cheaply extractable from the minified `dist/` (grep for `--oq6d070:var(--sable` found nothing; compiled output uses different var indices).
- **FUTURE ENHANCEMENT (turnkey recipe, already reverse-engineered)**: No vanilla-extract compile needed. The runtime `folds.color` object carries the real CSS var names, and Charm's `sableThemeMapping` (in `src/colors.css.ts`) is a plain object. Walk both in parallel to generate a `.charm-theme { --oq6d0XX: var(--sable-*); … }` class:
  ```js
  const { color } = require('node_modules/folds/dist/index.js');
  // sableThemeMapping copied from src/colors.css.ts
  // for each leaf path P: varName = color[P] (e.g. "var(--oq6d07f)"), value = mapping[P] (e.g. "var(--sable-primary-main)")
  // emit `${varName.slice(4,-1)}: ${value};` inside `.charm-theme{…}`
  ```
  Then: (a) prepend `.charm-theme{…}` + the `.light-theme` sable definitions from `src/app/styles/themes.css` into the bundle's CSS closure, and (b) set provider className to `charm-theme light-theme _164xfge0 dw378b0`.
  - BLOCKER for clean injection: `cssEntry` is bounded to the folds package dir; `tokensGlob` needs a node_modules `tokensPkg`. Neither reaches a Charm-repo CSS file. Options: fork `css.mjs` to append an extra workspace CSS file, OR a documented build-wrapper step that copies the generated CSS into `node_modules/folds/dist/` and points `cssEntry` there. Until implemented, folds default (blue) is the honest, functional appearance.
- Reference values confirmed: `Primary.Main` = `var(--oq6d07f)`, `--sable-primary-main` = `#6e56cf` (light).

## Preview authoring learnings (from solo calibration: Button/Text/Input/Badge)

- **Import from `'folds'`** — `import { Button, Box, Text, Icon, Icons } from 'folds'`. Named exports become card cells. The story-imports plugin shims `'folds'` → `window.Folds`.
- **Layout**: wrap multi-item cells in `<Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>`. Box gap tokens are strings: "0".."700".
- **Icons**: `<Icon size="200" src={Icons.Send} />` — `Icons` is the registry (Home, User, Send, Search, Check, Cross, Delete, ChevronRight/Left/Top/Bottom, ArrowRight, etc.). VERIFY names via `node -e "console.log(Object.keys(require('folds').Icons))"` before using — invalid names crash the preview.
- **Button/Chip/Badge**: `variant` (Primary/Secondary/Success/Warning/Critical; Chip/Input also Background/Surface/SurfaceVariant), `fill` (Solid/Soft/None), `size`, `outlined`, `radii` (0/300/400/500/Pill/Inherit). Label goes in children, usually `<Text as="span" size="B400">`.
- **Input**: use `outlined` when showing sizes/variants on a white page — plain Surface inputs are white-on-white and look like floating text (looks unstyled). `variant="Critical" outlined` = invalid state.
- **Text sizes**: H1-H6 (headings), T500/T400/T300/T200 (body), B500/B400/B300 (button), L400 (label), O400 (overline), C400 (caption). `align`, `truncate`, `priority`.
- **Colors are folds DEFAULT (blue primary), not Charm purple** — see theme fidelity note below. Grade on the absolute rubric accordingly; blue is correct/expected here.
- Realistic Charm content: room names, @mxid handles, "Send message", "Delete room", notification counts (12, 99+).

## Per-component API gotchas (folds 2.6.2 — folded from all authoring batches)

Extraction dropped generic-wrapped props for Button/Chip/MenuItem (fixed via `dtsPropsFor`). Real APIs & sibling-differences that bit us:
- **`fill` values differ**: Button/Badge have `Solid | Soft | None`; **Chip and IconButton have only `Soft | None`** (NO `Solid`). MenuItem too: `Soft | None`.
- **Size scales differ**: Icon `50/100/200/300/400/500/600`; IconButton `300/400/500/600` (no 200); Avatar `200/300/400/500`; Badge `200..500`; Chip `400/500`; Line `300/400/500/600/700` (no 0/100/200); ProgressBar/Modal `300/400/500`; MenuItem `300/400`; Switch has NO size prop.
- **Checkbox/RadioButton**: `<input>`-based, uncontrolled via `defaultChecked` (no handler needed). `variant`, `size` (50..600).
- **Switch**: CONTROLLED `<button>` — uses `value: boolean` + `onChange: (on)=>void` (NOT checked/defaultChecked), no `size`. Pass a no-op `onChange` for static states.
- **AvatarFallback** has no default background — needs explicit `style={{ backgroundColor, color:'white' }}` or initials are invisible. `<Avatar size radii>` wraps exactly ONE of AvatarImage/AvatarFallback.
- **ProgressBar**: `value`+`max` REQUIRED; renders as a span so put `style={{ width: 240 }}` on the bar itself, not a wrapper.
- **TextArea/Input**: use `outlined` — plain Surface is white-on-white and looks unstyled. `variant="Critical" outlined` = error state.
- **Header**: no default background/border — add `style={{ borderBottom, background }}` + real content (grow-title Box + trailing IconButtons) or it renders as floating text.
- **Line**: horizontal needs container width; vertical needs explicit `style={{ height }}`.
- **Scroll**: put the fixed height on the `<Scroll>` element itself (base class is `height:100%; overflow:hidden`), not a parent wrapper, or there's no scroll region.
- **Layout idiom**: Box native props work — `<Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">`, no inline flex needed. gap tokens are strings "0".."700"; justify/align use PascalCase enums (Start/Center/End/SpaceBetween...).
- **AvatarImage**: prefer inline SVG gradient data-URIs over network image URLs for deterministic headless capture (pravatar.cc did load, but data-URIs are network-free).

## Known render warns / capture-environment limitations

- **`[RENDER_THIN] Icon`** — BENIGN, expected. The Icon previews render SVG glyphs (no text nodes), and the thin-check keys on "mounts have no text". Confirmed via screenshot: FILLED/GRID/SIZES cells all paint icons correctly. Do NOT treat as a regression on re-sync.
- **`[GRID_OVERFLOW] Overlay` / `[GRID_OVERFLOW] PopOut`** — expected (portal/fixed positioning). Resolved via `cfg.overrides.{Overlay,PopOut}.cardMode = "single"`. Not a new warn.

- **Scroll styled scrollbar chrome does NOT render in the capture Chromium** (Playwright 1.61.0 uses overlay scrollbars: `::-webkit-scrollbar` reserves 0px, idle thumb transparent). So folds' `visibility`/`size`/`hideTrack`/variant thumb colors are invisible in captures. Scroll previews therefore demonstrate the scroll CONTAINER (bounded viewport + clipped overflowing content) — environment-independent, graded good on that basis. OPTIONAL future fix: launch capture Chromium with `--disable-features=OverlayScrollbar` in `.ds-sync/package-capture.mjs`, then revert Scroll cells to variant/size axes. Not applied (clipped-overflow demo is robust and doesn't need it).

## Theme / Provider

- folds uses vanilla-extract at build time; compiled class names are `configClass = _164xfge0`, `varsClass = dw378b0`
- Charm's sable semantic tokens (`--sable-bg-container`, `--sable-primary-main`, etc.) are in `src/app/styles/themes.css` via `.light-theme` / `.dark-theme` CSS classes
- Provider: `Box` from folds with `className="light-theme _164xfge0 dw378b0"` — applies folds config/vars AND Charm light theme
- If vanilla-extract class names change on a folds version bump, update `provider.props.className` in config.json AND `.design-sync/conventions.md`

## CSS Architecture

- folds' `style.css` contains all component styles (mangled `--oq6d0*` tokens internally, not intended for direct use)
- Charm's semantic layer uses named `--sable-*` custom properties, defined in themes.css
- Tokens needed: `.light-theme` class applied to wrapper (not `:root`)

## Fonts

- Nunito Variable: loaded via `@fontsource-variable/nunito`
- Space Mono: loaded via `@fontsource/space-mono`
- Twemoji: emoji font — not critical for component previews; excluded from extraFonts

## Charm App Components (second phase)

- Most Charm app components (`src/app/components/`) require Matrix state (matrix-js-sdk, routing, Tauri)
- Targeted presentational candidates for a later pass: unread-badge, typing-indicator, server-badge, presence, time-date, stacked-avatar, notification-banner, setting-tile, room-avatar
- These need individual investigation before authoring previews
- `Portal` excluded from folds sync (componentSrcMap: null) — renders into a DOM portal, can't show in card

## Re-sync Risks (watch-list for the next sync)

- **VANILLA-EXTRACT CLASS NAMES ARE THE #1 RISK.** The provider className `oq6d071w _164xfge0 dw378b0` (folds lightTheme + config + vars) is HARDCODED in `cfg.provider.props.className`. These hashes are deterministic for folds 2.6.2 but WILL CHANGE on any folds version bump. If they change and config isn't updated, EVERY preview renders unstyled (serif fallback, no theme). On re-sync after a folds bump, FIRST run: `~/.nvm/versions/node/v24.14.0/bin/node -e "const c=require('/Users/evie/git/Charm/node_modules/folds/dist/index.js');console.log('config',c.configClass,'vars',c.varsClass,'light',c.lightTheme)"` and update `cfg.provider.props.className` if any differ (order: lightTheme configClass varsClass).
- **The two lib forks (`dts.mjs`, `source-kit.mjs`) may drift from upstream.** On re-sync, re-copy staged scripts then diff `.design-sync/overrides/*.mjs` against `.ds-sync/lib/*.mjs`; merge upstream changes. The forks exist ONLY because folds lacks a `types` field — if a future folds release adds `"types": "dist/index.d.ts"`, both forks become unnecessary (delete them + their `cfg.libOverrides` entries + the `.design-sync/node_modules` symlink).
- **Fresh-clone setup**: `.ds-sync/` and `.design-sync/node_modules` are gitignored. On a fresh clone you must: re-stage scripts (`cp -r <skill>/... .ds-sync/`), `cd .ds-sync && npm i esbuild ts-morph @types/react`, recreate `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` (the forks import ts-morph via this), and symlink/point node_modules so folds resolves (build uses real `/Users/evie/git/Charm/node_modules`, NOT the worktree symlink — ts-morph realpath issue).
- **Font paths** (`../@fontsource-variable/nunito/index.css` etc., relative to folds PKG_DIR) break if Charm changes/removes the fontsource deps. Validate prints `[FONT_MISSING]` if so.
- **Authored previews** in `.design-sync/previews/` are tied to the folds 2.6.2 API (variant/size enums, Icons registry names). Verify on folds version bumps — see the "Per-component API gotchas" section for the exact enums that were correct at 2.6.2.
- **Only PARTIALLY delivered**: Charm's PURPLE brand theme (folds default BLUE was shipped). Turnkey recipe to add it is documented above under "Theme fidelity". This is the biggest known gap vs a fully on-brand import.
- **NOT attempted**: Charm's own app components (`src/app/components/`) — the user scoped "standalone ones" but they proved to need Matrix state; deferred. Candidates listed above. A future sync could add presentational ones (unread-badge, typing-indicator, server-badge, time-date, etc.) as a second group.
- **Scroll scrollbar chrome** never actually verified (overlay-scrollbar capture limitation) — see Known render warns.
