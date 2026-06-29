import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const SplashScreen = style({
  flexGrow: 1,
  backgroundColor: color.Background.Container,
  color: color.Background.OnContainer,
});

export const SplashScreenFooter = style({
  paddingTop: config.space.S400,
  paddingLeft: config.space.S400,
  paddingRight: config.space.S400,
  paddingBottom: `calc(${config.space.S400} + env(safe-area-inset-bottom, 0px))`,
});
