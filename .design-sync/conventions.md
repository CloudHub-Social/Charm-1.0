# Charm design system (folds) — how to build with it

Charm's UI is built on **folds** (`cinnyapp/folds`) — a React design system. Import every component from `folds`. This is a **prop-driven** system: there are **no utility CSS classes** to compose. You style by passing enum props (`variant`, `size`, `fill`, `radii`, `gap`, `direction`, …), never by writing class names. Do not invent Tailwind-style classes — they will not resolve.

## Wrapping and setup (required, or components render unstyled)

folds ships its styles as vanilla-extract classes and reads its tokens/fonts from an ancestor element. Put these three classes on your app root (or a top-level wrapper), and set the base font — otherwise text falls back to a serif system font and colors/tokens are missing:

```jsx
import { Box } from 'folds';

<Box
  className="oq6d071w _164xfge0 dw378b0"
  style={{ fontFamily: "'Nunito Variable', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" }}
>
  {/* your whole app */}
</Box>
```

- `oq6d071w` — folds default **light theme** (color tokens). `_164xfge0` — the **config** class (font-size scale, radii, spacing tokens). `dw378b0` — the **vars** class (focus outline). All three are needed.
- Components use `font-family: inherit`, so the base font MUST be set on the wrapper (Charm uses **Nunito Variable** for text, **Space Mono** for monospace). Without it, headings render as serif.
- Colors here are folds' **default palette (blue primary)**. Charm's production purple brand comes from a separate vanilla-extract theme that remaps folds' color vars to Charm's `--sable-*` tokens — not part of this bundle.

## The styling idiom — props, not classes

Every visual choice is a prop with a **fixed enum value** (PascalCase names or token strings — not arbitrary CSS):

- **Semantic color** → `variant`. Action colors: `"Primary" | "Secondary" | "Success" | "Warning" | "Critical"`. Container/surface roles (Menu, Input, Chip, Dialog, Modal): also `"Background" | "Surface" | "SurfaceVariant"`.
- **Emphasis** → `fill`: `"Solid" | "Soft" | "None"` (Button/Badge). Note **Chip, IconButton, MenuItem have only `"Soft" | "None"`** (no Solid).
- **Size** → `size`, as token strings. Scales vary per component: Text uses `"H1".."H6"`, `"T500".."T200"`, `"B500".."B300"`, `"L400"`, `"O400"`, `"C400"`; Button/Modal `"300"|"400"|"500"`; Icon `"50".."600"`; Avatar `"200".."500"`.
- **Corners** → `radii`: `"0" | "300" | "400" | "500" | "Pill" | "Inherit"`.
- **Layout** → the `Box` primitive (flexbox via props): `direction` (`"Row"|"Column"`), `gap` (`"0".."700"`), `justifyContent` / `alignItems` (`"Start"|"Center"|"End"|"SpaceBetween"|…`), `wrap`, `grow`. Compose all layout with `Box` + gap tokens — do not hand-write flexbox CSS.
- **Icons** → `<Icon size="300" src={Icons.Send} />`. `Icons` is a name→glyph registry (`Home`, `User`, `Send`, `Search`, `Bell`, `Star`, `Pin`, `Delete`, `Cross`, `Check`, `ReplyArrow`, `ChevronBottom`, …); `filled` toggles outline vs solid. `IconButton` wraps an `Icon`.

Forms: `Input`/`TextArea` take `variant`/`size`/`outlined` (use `outlined` — a bare Surface input is white-on-white). `Checkbox`/`RadioButton` are uncontrolled via `defaultChecked`. `Switch` is controlled: `value={boolean}` + `onChange`, no `size`. Overlays: `Dialog`/`Modal` are styled surfaces; center them with `OverlayCenter` (give it `width:100%`); `Menu` + `MenuItem` build dropdowns; `Overlay` (open + backdrop) and `PopOut` (anchored) portal to a container.

## Where the truth lives

- Per-component API + usage: each component's bound `<Name>.d.ts` (the exact `<Name>Props`) and `<Name>.prompt.md` (usage). Read these before composing a component.
- The stylesheet closure: `styles.css` (`@import`s `_ds_bundle.css` — folds' compiled component styles — plus fonts). Read it before overriding anything.

## One idiomatic example

```jsx
import { Box, Text, Button, Icon, Icons } from 'folds';

// A leave-room confirmation, styled entirely with folds props:
<Box direction="Column" gap="400" style={{ padding: 24, maxWidth: 340 }}>
  <Text size="H4">Leave room?</Text>
  <Text size="T300" priority="300">
    You&apos;ll stop receiving messages from #general.
  </Text>
  <Box gap="200" justifyContent="End">
    <Button variant="Secondary" fill="Soft" size="300">
      <Text as="span" size="B300">Cancel</Text>
    </Button>
    <Button variant="Critical" fill="Solid" size="300" before={<Icon size="200" src={Icons.Delete} />}>
      <Text as="span" size="B300">Leave room</Text>
    </Button>
  </Box>
</Box>
```
