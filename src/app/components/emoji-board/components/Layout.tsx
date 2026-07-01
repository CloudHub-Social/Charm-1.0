import { as, Box, Line, Scroll } from 'folds';
import type { KeyboardEventHandler, ReactNode, Ref } from 'react';
import classNames from 'classnames';
import * as css from './styles.css';

export const EmojiBoardLayout = as<
  'div',
  {
    header: ReactNode;
    mobileSheetHandle?: ReactNode;
    sidebar?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    isFullWidth?: boolean;
    isGifLayout?: boolean;
    scrollRef?: Ref<HTMLDivElement>;
    onScrollKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  }
>(
  (
    {
      className,
      header,
      mobileSheetHandle,
      sidebar,
      children,
      footer,
      isFullWidth,
      isGifLayout,
      scrollRef,
      onScrollKeyDown,
      ...props
    },
    ref
  ) => (
    <Box
      display="InlineFlex"
      className={classNames(css.Base({ isFullWidth, isGifLayout }), className)}
      direction="Column"
      {...props}
      ref={ref}
    >
      <Box
        className={classNames(css.Header, isGifLayout && css.GifHeaderShell)}
        direction="Column"
        shrink="No"
      >
        {mobileSheetHandle}
        {header}
      </Box>
      {/*
       * Content and sidebar share a single scroll region (with the vertical
       * Line as a visual-only divider) instead of each scrolling
       * independently — two scrollbars on a short mobile sheet meant the
       * sidebar's category icons could scroll out of reach on their own.
       */}
      <Box direction="Column" grow="Yes" style={{ minHeight: 0 }}>
        <Scroll ref={scrollRef} size="400" onKeyDown={onScrollKeyDown} hideTrack>
          <Box direction="Row">
            <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
              {children}
            </Box>
            {sidebar && (
              <>
                <Line size="300" direction="Vertical" />
                {sidebar}
              </>
            )}
          </Box>
        </Scroll>
      </Box>
      {footer}
    </Box>
  )
);
