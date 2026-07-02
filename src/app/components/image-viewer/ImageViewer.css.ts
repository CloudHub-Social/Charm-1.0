import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const ImageViewer = style([
  DefaultReset,
  {
    height: '100%',
  },
]);

export const ImageViewerHeader = style([
  DefaultReset,
  {
    paddingLeft: config.space.S200,
    paddingRight: config.space.S200,
    borderBottomWidth: config.borderWidth.B300,
    flexShrink: 0,
    gap: config.space.S200,
    // Folds' Header size="400" sets a fixed height (2.5rem/40px), but this
    // header contains size="500" IconButtons (44px) for touch-target
    // compliance. Override the fixed height at all viewport widths so the
    // box grows to fit its content instead of clipping/overflowing the
    // buttons.
    height: 'auto',
    minHeight: toRem(40),
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: config.space.S200,
    '@media': {
      '(max-width: 600px)': {
        // On narrow viewports the controls also wrap onto a second row
        // instead of overflowing into (and being unclickable under) the
        // image content area below.
        flexWrap: 'wrap',
        rowGap: config.space.S100,
      },
    },
  },
]);

// Title/back-button group. Forced onto its own row on mobile so the controls
// group below always has the full viewport width to lay out in.
export const ImageViewerHeaderTitle = style([
  DefaultReset,
  {
    '@media': {
      '(max-width: 600px)': {
        flexBasis: '100%',
      },
    },
  },
]);

// Zoom/download controls group. On mobile it gets its own row; if the
// controls still don't fit (e.g. extra zoom buttons appear), it scrolls
// horizontally instead of clipping off-screen where it can't be reached.
export const ImageViewerHeaderControls = style([
  DefaultReset,
  {
    '@media': {
      '(max-width: 600px)': {
        flexBasis: '100%',
        // minWidth: 0 lets this flex item shrink below its content's
        // intrinsic width — without it, overflowX would never kick in and
        // the row would just grow past the viewport instead of scrolling.
        minWidth: 0,
        // Start-aligned (not flex-end) so overflow-x scroll begins at the
        // first control instead of putting it off-screen to the left with
        // no way to reach it.
        justifyContent: 'flex-start',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      },
    },
  },
]);

export const ImageViewerContent = style([
  DefaultReset,
  {
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    overflow: 'hidden',
  },
]);

export const ImageViewerInput = style([
  DefaultReset,
  {
    all: 'unset',
    fieldSizing: 'content',
    textAlign: 'center',
    font: 'inherit',
    color: 'inherit',
  },
]);

export const ImageViewerImg = style([
  DefaultReset,
  {
    userSelect: 'none',
    touchAction: 'none',
    display: 'block',
    objectFit: 'contain',
    width: 'auto',
    height: 'auto',
    maxWidth: 'none',
    maxHeight: 'none',
    backgroundColor: color.Surface.Container,
    transition: 'transform 100ms linear',
    willChange: 'transform',
  },
]);

export const ImageViewerImgPixelated = style({
  imageRendering: 'pixelated',
});
