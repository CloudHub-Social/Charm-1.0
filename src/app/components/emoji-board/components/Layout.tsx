import { as, Box, Line, Scroll } from 'folds';
import type { KeyboardEventHandler, ReactNode, Ref } from 'react';
import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import * as css from './styles.css';

export const EmojiBoardLayout = as<
  'div',
  {
    header: ReactNode;
    mobileSheetHandle?: ReactNode;
    sidebar?: ReactNode;
    pinnedSidebarFooter?: ReactNode;
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
      pinnedSidebarFooter,
      children,
      footer,
      isFullWidth,
      isGifLayout,
      scrollRef,
      onScrollKeyDown,
      ...props
    },
    ref
  ) => {
    const pinnedFooterRef = useRef<HTMLDivElement>(null);
    const [pinnedFooterHeight, setPinnedFooterHeight] = useState(0);

    const hasPinnedFooter = Boolean(pinnedSidebarFooter);
    useEffect(() => {
      const el = pinnedFooterRef.current;
      if (!el) {
        setPinnedFooterHeight(0);
        return undefined;
      }
      const observer = new ResizeObserver((entries) => {
        setPinnedFooterHeight(entries[0]?.contentRect.height ?? 0);
      });
      observer.observe(el);
      return () => observer.disconnect();
      // Only rerun when the footer's presence toggles (mount/unmount) —
      // pinnedSidebarFooter is a new ReactNode reference on most renders,
      // which would otherwise tear down and recreate the ResizeObserver on
      // every re-render even though the observed DOM node hasn't changed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasPinnedFooter]);

    return (
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
         * pinnedSidebarFooter (the standard emoji-group categories) sits
         * outside that scroll, absolutely positioned over its bottom edge —
         * position: sticky doesn't reliably stay pinned once content and
         * sidebar share one scroll container on real mobile browsers.
         */}
        <Box className={css.ScrollArea} direction="Column" grow="Yes" style={{ minHeight: 0 }}>
          <Scroll ref={scrollRef} size="400" onKeyDown={onScrollKeyDown} hideTrack>
            {/*
             * paddingBottom reserves space equal to the pinned footer's
             * measured height, so scrolling to the end reveals the last
             * content/sidebar rows above the footer instead of leaving them
             * permanently hidden underneath its absolute-positioned overlay.
             */}
            <Box direction="Row" style={{ paddingBottom: pinnedFooterHeight }}>
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
          {pinnedSidebarFooter && (
            <Box ref={pinnedFooterRef} className={css.PinnedSidebarFooter} shrink="No">
              {pinnedSidebarFooter}
            </Box>
          )}
        </Box>
        {footer}
      </Box>
    );
  }
);
