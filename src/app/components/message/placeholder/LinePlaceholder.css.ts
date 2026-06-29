import type { ComplexStyleRule } from '@vanilla-extract/css';
import { keyframes } from '@vanilla-extract/css';
import type { RecipeVariants } from '@vanilla-extract/recipes';
import { recipe } from '@vanilla-extract/recipes';
import type { ContainerColor } from 'folds';
import { DefaultReset, color, config, toRem } from 'folds';

const shimmer = keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.5 },
  '100%': { opacity: 1 },
});

const getVariant = (variant: ContainerColor): ComplexStyleRule => ({
  backgroundColor: color[variant].Container,
});

export const LinePlaceholder = recipe({
  base: [
    DefaultReset,
    {
      width: '100%',
      height: toRem(16),
      borderRadius: config.radii.R300,
      animation: `${shimmer} 1.6s ease-in-out infinite`,
    },
  ],
  variants: {
    variant: {
      Background: getVariant('Background'),
      Surface: getVariant('Surface'),
      SurfaceVariant: getVariant('SurfaceVariant'),
      Primary: getVariant('Primary'),
      Secondary: getVariant('Secondary'),
      Success: getVariant('Success'),
      Warning: getVariant('Warning'),
      Critical: getVariant('Critical'),
    },
  },
  defaultVariants: {
    variant: 'SurfaceVariant',
  },
});

export type LinePlaceholderVariants = RecipeVariants<typeof LinePlaceholder>;
