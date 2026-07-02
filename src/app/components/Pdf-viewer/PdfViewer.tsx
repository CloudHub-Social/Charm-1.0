import type { FormEventHandler, MouseEventHandler, MutableRefObject } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import classNames from 'classnames';
import type { RectCords } from 'folds';
import {
  Box,
  Button,
  Chip,
  Header,
  IconButton,
  Input,
  Menu,
  PopOut,
  Scroll,
  Spinner,
  Text,
  as,
  config,
} from 'folds';
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  Download,
  Minus,
  Plus,
  Warning,
  sizedIcon,
} from '$components/icons/phosphor';
import FocusTrap from 'focus-trap-react';
import FileSaver from 'file-saver';
import { AsyncStatus } from '$hooks/useAsyncCallback';
import { useImageGestures } from '$hooks/useImageGestures';
import { createPage, usePdfDocumentLoader, usePdfJSLoader } from '$plugins/pdfjs-dist';
import { stopPropagation } from '$utils/keyboard';
import { focusTrapFallbackFocus } from '$utils/dom';
import * as css from './PdfViewer.css';

export type PdfViewerProps = {
  name: string;
  src: string;
  requestClose: () => void;
};

export const PdfViewer = as<'div', PdfViewerProps>(
  ({ className, name, src, requestClose, ...props }, forwardedRef) => {
    const titleId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const jumpMenuRef = useRef<HTMLDivElement>(null);
    // Memoized: an inline callback ref here would be recreated on every
    // render, which makes React detach the old ref (calling it with `null`)
    // before attaching the new one on every re-render - not just on mount.
    // That creates a real, transient window where `rootRef.current` is
    // `null` on every re-render. `focusTrapFallbackFocus` below is only
    // safe to call while a ref is actually populated, so this must stay
    // referentially stable across renders (only changing if the forwarded
    // ref itself changes) rather than being redefined inline.
    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    const {
      transforms: { zoom },
      zoomIn,
      zoomOut,
      setZoom,
      onPointerDown,
    } = useImageGestures(true, 0.2, 0.1, 5);

    const [pdfJSState, loadPdfJS] = usePdfJSLoader();
    const [docState, loadPdfDocument] = usePdfDocumentLoader(
      pdfJSState.status === AsyncStatus.Success ? pdfJSState.data : undefined,
      src
    );
    const isLoading =
      pdfJSState.status === AsyncStatus.Loading || docState.status === AsyncStatus.Loading;
    const isError =
      pdfJSState.status === AsyncStatus.Error || docState.status === AsyncStatus.Error;
    const [pageNo, setPageNo] = useState(1);
    const [jumpAnchor, setJumpAnchor] = useState<RectCords>();
    // Tracks the target of the most recent `mousedown` while the jump-to-page
    // popout's FocusTrap is active, so its `onDeactivate` (which focus-trap-react
    // calls with no arguments - see focus-trap@7.8.0's `deactivate()`) can still
    // tell whether the click that closed it landed outside the *viewer* too.
    const lastPointerDownTargetRef = useRef<EventTarget | null>(null);

    useEffect(() => {
      // Registered unconditionally (for the component's whole lifetime,
      // not just while the popout is open) and in the capture phase so it
      // is guaranteed to be attached to `document` *before* the popout's
      // own FocusTrap ever activates - and therefore before focus-trap's own
      // `checkPointerDown` capture listener (added when that trap's
      // `componentDidMount` runs). Capture-phase listeners on the same
      // target fire in registration order, so gating this on `jumpAnchor`
      // (i.e. registering it in the same commit that mounts the popout's
      // trap) raced with focus-trap's own listener and lost half the time.
      const recordPointerDownTarget = (evt: MouseEvent | TouchEvent) => {
        lastPointerDownTargetRef.current = evt.target;
      };
      document.addEventListener('mousedown', recordPointerDownTarget, true);
      document.addEventListener('touchstart', recordPointerDownTarget, true);
      return () => {
        document.removeEventListener('mousedown', recordPointerDownTarget, true);
        document.removeEventListener('touchstart', recordPointerDownTarget, true);
      };
    }, []);

    const handleJumpMenuDeactivate = useCallback(() => {
      setJumpAnchor(undefined);
      // The jump-to-page popout is rendered through a React Portal (folds'
      // `PopOut` mounts its content on `document.body` by default), so it is
      // not a DOM descendant of `rootRef` even though it's nested under
      // `PdfViewer` in the React tree - a plain ref/DOM `.contains()` check on
      // the popout's own root would never catch a click made outside it, we
      // need the last recorded mousedown target compared against the viewer's
      // own root instead. That same portal gap means a click on the popout's
      // *own* controls (e.g. the "Jump To Page" submit button, which also
      // deactivates this trap) is not a DOM descendant of `rootRef` either -
      // it must be excluded via `jumpMenuRef` explicitly, or every ordinary
      // popout interaction that closes the popout would be misread as
      // "outside the viewer" and wrongly close the whole thing.
      //
      // If the click landed outside both the popout and the viewer's root,
      // this is the "close everything in one click" case from the Sentry
      // finding: the innermost trap's own outside-click handling consumes
      // the mousedown event to deactivate itself and unpause the middle
      // (viewer) trap, but that unpause happens synchronously *after* the
      // mousedown has already finished dispatching, so the viewer trap's own
      // (now freshly re-added) listeners never see it and the viewer stays
      // open. Forward the request here instead, using the same event the
      // popout itself reacted to.
      //
      // If the click landed inside the popout or inside the viewer (e.g.
      // dismissing the popout by clicking elsewhere on the PDF page), only
      // close the popout - do not touch the outer trap.
      const target = lastPointerDownTargetRef.current;
      const root = rootRef.current;
      const menu = jumpMenuRef.current;
      if (
        target instanceof Node &&
        root &&
        !root.contains(target) &&
        !(menu && menu.contains(target))
      ) {
        requestClose();
      }
    }, [requestClose]);

    useEffect(() => {
      loadPdfJS();
    }, [loadPdfJS]);
    useEffect(() => {
      if (pdfJSState.status === AsyncStatus.Success) {
        loadPdfDocument();
      }
    }, [pdfJSState, loadPdfDocument]);

    useEffect(() => {
      if (docState.status === AsyncStatus.Success) {
        const doc = docState.data;
        if (pageNo < 0 || pageNo > doc.numPages) return;
        createPage(doc, pageNo, { scale: zoom }).then((canvas) => {
          const container = containerRef.current;
          if (!container) return;
          container.textContent = '';
          container.append(canvas);
          canvas.style.touchAction = 'pan-x pan-y';
        });
      }
    }, [docState, pageNo, zoom]);

    const handleDownload = () => {
      FileSaver.saveAs(src, name);
    };

    const handleJumpSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
      evt.preventDefault();
      if (docState.status !== AsyncStatus.Success) return;
      const jumpInput = evt.currentTarget.jumpInput as HTMLInputElement;
      if (!jumpInput) return;
      const jumpTo = Number.parseInt(jumpInput.value, 10);
      setPageNo(Math.max(1, Math.min(docState.data.numPages, jumpTo)));
      setJumpAnchor(undefined);
    };

    const handlePrevPage = () => {
      setPageNo((n) => Math.max(n - 1, 1));
    };

    const handleNextPage = () => {
      if (docState.status !== AsyncStatus.Success) return;
      setPageNo((n) => Math.min(n + 1, docState.data.numPages));
    };

    const handleOpenJump: MouseEventHandler<HTMLButtonElement> = (evt) => {
      // Reset for this popout session: without this, closing the popout via
      // Escape or the submit button (neither of which involves a new
      // mousedown) would fall back to whatever mousedown was last recorded
      // - which could predate this popout opening entirely (e.g. a keyboard
      // user tabs to and activates this button, then a stale mousedown from
      // earlier in the session, possibly outside the viewer, would otherwise
      // be misread as "close everything").
      lastPointerDownTargetRef.current = null;
      setJumpAnchor(evt.currentTarget.getBoundingClientRect());
    };

    return (
      <FocusTrap
        focusTrapOptions={{
          // The viewer root has `tabIndex={-1}` below, so it's always
          // programmatically focusable; never fall back to `document.body`,
          // which would leave focus outside the trap (see Finding 1's fix
          // in ThemeCatalogOnboarding.tsx for the same failure mode). Uses
          // the shared `focusTrapFallbackFocus` helper (see `$utils/dom`)
          // which is null-safe at runtime instead of casting the ref.
          fallbackFocus: focusTrapFallbackFocus(rootRef),
          onDeactivate: requestClose,
          // This trap is nested inside FileContent.tsx's `ReadPdfFile`
          // FocusTrap (which has `clickOutsideDeactivates: true` for
          // backdrop-click-to-close). Once this inner trap activates, it
          // pauses the outer one, so the outer trap's
          // `clickOutsideDeactivates` no longer has any effect on backdrop
          // clicks - only this trap's own config does. Setting it to
          // `true` here (with `onDeactivate: requestClose` above) keeps
          // backdrop-click-to-close working end to end instead of
          // silently swallowing the click.
          clickOutsideDeactivates: true,
          escapeDeactivates: stopPropagation,
        }}
      >
        <Box
          className={classNames(css.PdfViewer, className)}
          direction="Column"
          data-gestures="ignore"
          onPointerDown={(e) => e.stopPropagation()}
          {...props}
          ref={setRootRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <Header className={css.PdfViewerHeader} size="400">
            <Box grow="Yes" alignItems="Center" gap="200">
              <IconButton size="300" radii="300" onClick={requestClose} aria-label="Close">
                {sizedIcon(ArrowLeft, '50')}
              </IconButton>
              <Text id={titleId} size="T300" truncate>
                {name}
              </Text>
            </Box>
            <Box shrink="No" alignItems="Center" gap="200">
              <IconButton
                variant={zoom < 1 ? 'Success' : 'SurfaceVariant'}
                outlined={zoom < 1}
                size="300"
                radii="Pill"
                onClick={zoomOut}
                aria-label="Zoom Out"
              >
                {sizedIcon(Minus, '50')}
              </IconButton>
              <Chip
                variant="SurfaceVariant"
                radii="Pill"
                onClick={() => setZoom(zoom === 1 ? 2 : 1)}
              >
                <Text size="B300">{Math.round(zoom * 100)}%</Text>
              </Chip>
              <IconButton
                variant={zoom > 1 ? 'Success' : 'SurfaceVariant'}
                outlined={zoom > 1}
                size="300"
                radii="Pill"
                onClick={zoomIn}
                aria-label="Zoom In"
              >
                {sizedIcon(Plus, '50')}
              </IconButton>
              <Chip
                variant="Primary"
                onClick={handleDownload}
                radii="300"
                before={sizedIcon(Download, '50')}
              >
                <Text size="B300">Download</Text>
              </Chip>
            </Box>
          </Header>
          <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="200">
            {isLoading && <Spinner variant="Secondary" size="600" />}
            {isError && (
              <>
                <Text>Failed to load PDF</Text>
                <Button
                  variant="Critical"
                  fill="Soft"
                  size="300"
                  radii="300"
                  before={sizedIcon(Warning, '50')}
                  onClick={loadPdfJS}
                >
                  <Text size="B300">Retry</Text>
                </Button>
              </>
            )}
            {docState.status === AsyncStatus.Success && (
              <Scroll
                ref={scrollRef}
                size="300"
                direction="Both"
                variant="Surface"
                visibility="Hover"
                style={{
                  width: '100%',
                  height: '100%',
                  touchAction: 'pan-x pan-y',
                }}
              >
                <Box style={{ minWidth: '100%', minHeight: '100%' }} onPointerDown={onPointerDown}>
                  <div className={css.PdfViewerContent} ref={containerRef} />
                </Box>
              </Scroll>
            )}
          </Box>
          {docState.status === AsyncStatus.Success && (
            <Header as="footer" className={css.PdfViewerFooter} size="400">
              <Chip
                variant="Secondary"
                radii="300"
                before={sizedIcon(CaretLeft, '50')}
                onClick={handlePrevPage}
                aria-disabled={pageNo <= 1}
              >
                <Text size="B300">Previous</Text>
              </Chip>
              <Box grow="Yes" justifyContent="Center" alignItems="Center" gap="200">
                <PopOut
                  anchor={jumpAnchor}
                  align="Center"
                  position="Top"
                  content={
                    <FocusTrap
                      focusTrapOptions={{
                        // NOT `initialFocus: false`: that option makes
                        // focus-trap-react skip moving focus into the trap
                        // entirely instead of falling back to the first
                        // tabbable node (see Finding 3/the theme catalog
                        // dialog fix for the same failure mode), which left
                        // keyboard users without focus moved into this
                        // popout when it opened. The popout root has
                        // `tabIndex={-1}` below, so fallbackFocus always
                        // resolves to it rather than `document.body`. Uses
                        // the shared `focusTrapFallbackFocus` helper (see
                        // `$utils/dom`) which is null-safe at runtime
                        // instead of casting the ref.
                        fallbackFocus: focusTrapFallbackFocus(jumpMenuRef),
                        // See `handleJumpMenuDeactivate` above: closes just the
                        // popout for clicks still inside the viewer, and also
                        // requests the viewer itself close for clicks fully
                        // outside both (the nested-trap click-swallowing bug
                        // from PR #512's Sentry finding, one level in from the
                        // outer/middle trap fix applied above).
                        onDeactivate: handleJumpMenuDeactivate,
                        clickOutsideDeactivates: true,
                        escapeDeactivates: stopPropagation,
                      }}
                    >
                      <Menu ref={jumpMenuRef} tabIndex={-1} variant="Surface">
                        <Box
                          as="form"
                          onSubmit={handleJumpSubmit}
                          style={{ padding: config.space.S200 }}
                          direction="Column"
                          gap="200"
                        >
                          <Input
                            name="jumpInput"
                            size="300"
                            variant="Background"
                            defaultValue={pageNo}
                            min={1}
                            max={docState.data.numPages}
                            step={1}
                            outlined
                            type="number"
                            radii="300"
                            aria-label="Page Number"
                          />
                          <Button type="submit" size="300" variant="Primary" radii="300">
                            <Text size="B300">Jump To Page</Text>
                          </Button>
                        </Box>
                      </Menu>
                    </FocusTrap>
                  }
                >
                  <Chip
                    onClick={handleOpenJump}
                    variant="SurfaceVariant"
                    radii="300"
                    aria-pressed={jumpAnchor !== undefined}
                  >
                    <Text size="B300">{`${pageNo}/${docState.data.numPages}`}</Text>
                  </Chip>
                </PopOut>
              </Box>
              <Chip
                variant="Primary"
                radii="300"
                after={sizedIcon(CaretRight, '50')}
                onClick={handleNextPage}
                aria-disabled={pageNo >= docState.data.numPages}
              >
                <Text size="B300">Next</Text>
              </Chip>
            </Header>
          )}
        </Box>
      </FocusTrap>
    );
  }
);
