import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

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
    '@media': {
      '(max-width: 600px)': {
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: config.space.S200,
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
        justifyContent: 'flex-end',
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
