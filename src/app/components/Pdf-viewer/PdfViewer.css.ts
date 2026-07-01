import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

// Covers both iOS env() and Android/Tauri values injected by SystemBarShell.
const safeAreaTop = 'var(--sable-safe-area-top, env(safe-area-inset-top, 0px))';

export const PdfViewer = style([
  DefaultReset,
  {
    height: '100%',
  },
]);

export const PdfViewerHeader = style([
  DefaultReset,
  {
    paddingLeft: config.space.S200,
    paddingRight: config.space.S200,
    borderBottomWidth: config.borderWidth.B300,
    flexShrink: 0,
    gap: config.space.S200,
    '@media': {
      '(max-width: 600px)': {
        paddingTop: safeAreaTop,
        minHeight: `calc(2.5rem + ${safeAreaTop})`,
      },
    },
  },
]);
export const PdfViewerFooter = style([
  PdfViewerHeader,
  {
    borderTopWidth: config.borderWidth.B300,
    borderBottomWidth: 0,
    '@media': {
      '(max-width: 600px)': {
        paddingTop: 0,
        minHeight: '2.5rem',
      },
    },
  },
]);

export const PdfViewerContent = style([
  DefaultReset,
  {
    margin: 'auto',
    display: 'inline-block',
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
  },
]);
