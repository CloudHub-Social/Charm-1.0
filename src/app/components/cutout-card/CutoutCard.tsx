import type { ContainerColor as TContainerColor } from 'folds';
import { as } from 'folds';
import classNames from 'classnames';
import { ContainerColor } from '$styles/ContainerColor.css';
import * as css from './CutoutCard.css';

/**
 * `CutoutCard` always clips overflow (`CutoutCard.css.ts` sets
 * `overflow: hidden`), but not every instance has padding: some render
 * focusable children (e.g. `MenuItem` rows) flush against the card's own
 * edge, others give their children real breathing room via an inline
 * `style={{ padding: ... }}`. Only the flush/unpadded instances are at risk
 * of clipping a `:focus-visible` ring (see `General.css.ts`'s
 * `[data-focus-ring-inset]`-scoped rule) — the padded ones already have
 * enough buffer and should keep the normal outset ring like everywhere else.
 *
 * Since padding is applied via an arbitrary inline `style` prop (not a CSS
 * class), a plain CSS selector can't tell padded and unpadded instances
 * apart. `unpadded` makes that distinction explicit at the call site instead
 * of trying to infer it from `style`, and drives a `data-focus-ring-inset`
 * marker attribute (mirroring the existing `data-focus-ring-self` opt-in
 * pattern in `General.css.ts`) that the CSS rule targets directly.
 */
export const CutoutCard = as<'div', { variant?: TContainerColor; unpadded?: boolean }>(
  (
    { as: AsCutoutCard = 'div', className, variant = 'Surface', unpadded = false, ...props },
    ref
  ) => (
    <AsCutoutCard
      className={classNames(ContainerColor({ variant }), css.CutoutCard, className)}
      data-focus-ring-inset={unpadded ? '' : undefined}
      {...props}
      ref={ref}
    />
  )
);
