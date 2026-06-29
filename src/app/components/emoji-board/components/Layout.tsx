import { as, Box, Line } from 'folds';
import type { ReactNode } from 'react';
import classNames from 'classnames';
import * as css from './styles.css';

export const EmojiBoardLayout = as<
  'div',
  {
    header: ReactNode;
    sidebar?: ReactNode;
    children: ReactNode;
    isFullWidth?: boolean;
    isGifLayout?: boolean;
  }
>(({ className, header, sidebar, children, isFullWidth, isGifLayout, ...props }, ref) => (
  <Box
    display="InlineFlex"
    className={classNames(css.Base({ isFullWidth, isGifLayout }), className)}
    direction="Row"
    {...props}
    ref={ref}
  >
    <Box direction="Column" grow="Yes">
      <Box
        className={classNames(css.Header, isGifLayout && css.GifHeaderShell)}
        direction="Column"
        shrink="No"
      >
        {header}
      </Box>
      {children}
    </Box>
    <Line size="300" direction="Vertical" />
    {sidebar}
  </Box>
));
