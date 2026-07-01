import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

// Covers both iOS env() and Android/Tauri values injected by SystemBarShell.
const safeAreaTop = 'var(--sable-safe-area-top, env(safe-area-inset-top, 0px))';

export const TextViewer = style([
  DefaultReset,
  {
    height: '100%',
  },
]);

export const TextViewerHeader = style([
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

export const TextViewerContent = style([
  DefaultReset,
  {
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    overflow: 'hidden',
  },
]);

export const TextViewerPre = style([
  DefaultReset,
  {
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    fontSize: '1rem !important',
    lineHeight: 'inherit',
  },
]);

export const TextViewerPrePadding = style({
  padding: config.space.S600,
});
