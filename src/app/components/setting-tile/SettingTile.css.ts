import { style } from '@vanilla-extract/css';

export const settingTileRoot = style({
  minWidth: 0,
});

export const settingTileTitleRow = style({
  minWidth: 0,
});

const settingLinkActionBase = style({});

export const settingTileSettingLinkActionTransparentBackground = style({
  backgroundColor: 'transparent',
  selectors: {
    '&[aria-pressed=true]': {
      backgroundColor: 'transparent',
    },
    '&:hover': {
      backgroundColor: 'transparent',
    },
    '&:focus-visible': {
      backgroundColor: 'transparent',
    },
    '&:active': {
      backgroundColor: 'transparent',
    },
  },
});

export const settingTileSettingLinkAction = style([
  settingLinkActionBase,
  {
    // Keep the icon glyph small (sized via `sizedIcon(..., '50')`) but
    // guarantee a tap target that meets the WCAG 2.1 AA touch-target
    // recommendation (44x44 CSS px) via minWidth/minHeight plus centering
    // the smaller icon within that box, rather than scaling the icon itself up.
    minWidth: 44,
    minHeight: 44,
    width: 'auto',
    height: 'auto',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
]);

export const settingTileSettingLinkActionDesktopHidden = style([
  settingLinkActionBase,
  {
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.15s ease',
    selectors: {
      [`${settingTileRoot}:hover &`]: {
        opacity: 1,
        pointerEvents: 'auto',
      },
      [`${settingTileRoot}:focus-within &`]: {
        opacity: 1,
        pointerEvents: 'auto',
      },
    },
  },
]);

export const settingTileSettingLinkActionMobileVisible = style([
  settingLinkActionBase,
  {
    opacity: 1,
  },
]);
