import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const UserQuickTools = style({
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  position: 'absolute',
  zIndex: '1000',
  minHeight: toRem(74),
  bottom: '0',
  left: toRem(-66),
  padding: config.space.S300,
  paddingBottom: `max(${config.space.S300}, env(safe-area-inset-bottom, 0px))`,
  paddingLeft: `max(${config.space.S300}, env(safe-area-inset-left, 0px))`,
  borderTop: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
});
