import type { FormEventHandler, MouseEventHandler, MutableRefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
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
import * as css from './PdfViewer.css';

export type PdfViewerProps = {
  name: string;
  src: string;
  requestClose: () => void;
};

const PDF_VIEWER_TITLE_ID = 'pdf-viewer-title';

export const PdfViewer = as<'div', PdfViewerProps>(
  ({ className, name, src, requestClose, ...props }, forwardedRef) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const jumpMenuRef = useRef<HTMLDivElement>(null);
    const setRootRef = (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
      }
    };

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
      setJumpAnchor(evt.currentTarget.getBoundingClientRect());
    };

    return (
      <FocusTrap
        focusTrapOptions={{
          // The viewer root has `tabIndex={-1}` below, so it's always
          // programmatically focusable; never fall back to `document.body`,
          // which would leave focus outside the trap (see Finding 1's fix
          // in ThemeCatalogOnboarding.tsx for the same failure mode).
          fallbackFocus: () => rootRef.current as HTMLElement,
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
          aria-labelledby={PDF_VIEWER_TITLE_ID}
        >
          <Header className={css.PdfViewerHeader} size="400">
            <Box grow="Yes" alignItems="Center" gap="200">
              <IconButton size="300" radii="300" onClick={requestClose} aria-label="Close">
                {sizedIcon(ArrowLeft, '50')}
              </IconButton>
              <Text id={PDF_VIEWER_TITLE_ID} size="T300" truncate>
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
                        // resolves to it rather than `document.body`.
                        fallbackFocus: () => jumpMenuRef.current as HTMLElement,
                        onDeactivate: () => setJumpAnchor(undefined),
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
