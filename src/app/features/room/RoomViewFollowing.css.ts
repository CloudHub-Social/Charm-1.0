import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';

export const RoomViewFollowingPlaceholder = style([
  DefaultReset,
  {
    height: toRem(28),
  },
]);

export const RoomViewFollowing = recipe({
  base: [
    DefaultReset,
    {
      minHeight: toRem(28),
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: config.space.S400,
      paddingRight: `max(${config.space.S400}, env(safe-area-inset-right, 0px))`,
      width: '100%',
      backgroundColor: color.Surface.Container,
      color: color.Surface.OnContainer,
      outline: 'none',
      userSelect: 'none',
    },
  ],
  variants: {
    clickable: {
      true: {
        cursor: 'pointer',
        selectors: {
          '&:hover, &:focus-visible': {
            color: color.Primary.Main,
          },
          '&:active': {
            color: color.Primary.Main,
          },
        },
      },
    },
  },
});
