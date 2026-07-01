import { style } from '@vanilla-extract/css';

export const ModalWide = style({
  minWidth: '85vw',
  minHeight: '90vh',
  maxWidth: '100vw',
  maxHeight: '100dvh',

  '@media': {
    '(max-width: 600px)': {
      width: '100vw',
      height: '100dvh',
      minWidth: '100vw',
      minHeight: '100dvh',
      maxWidth: '100vw',
      maxHeight: '100dvh',
      borderRadius: 0,
    },
  },
});
