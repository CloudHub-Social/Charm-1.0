import type { ReactNode } from 'react';
import { useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { Modal, Overlay, OverlayBackdrop, OverlayCenter, color, config } from 'folds';
import { ScreenSize, useScreenSizeContext } from '$hooks/useScreenSize';
import { isPhoneLayoutDevice } from '$utils/user-agent';
import { stopPropagation } from '$utils/keyboard';
import { focusTrapFallbackFocus } from '$utils/dom';

type Modal500Props = {
  fullScreenOnMobile?: boolean;
  sheetOnMobile?: boolean;
  requestClose: () => void;
  children: ReactNode;
  /**
   * Accessible name for the dialog, announced by screen readers alongside
   * `role="dialog"`. Required so every `Modal500` has a real name instead of
   * screen readers announcing an unnamed "dialog" - use `ariaLabelledBy`
   * instead when the modal already renders a visible heading with a stable
   * `id` you can point to.
   */
  ariaLabel?: string;
  /** ID of an element (typically the modal's own heading) that labels the dialog. */
  ariaLabelledBy?: string;
} & (
  | { ariaLabel: string; ariaLabelledBy?: undefined }
  | { ariaLabel?: undefined; ariaLabelledBy: string }
);
export function Modal500({
  requestClose,
  children,
  fullScreenOnMobile = false,
  sheetOnMobile = false,
  ariaLabel,
  ariaLabelledBy,
}: Modal500Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile || isPhoneLayoutDevice();
  const useFullScreen = fullScreenOnMobile && isMobile;
  const useSheet = sheetOnMobile && isMobile && !useFullScreen;
  const modal = (
    <FocusTrap
      focusTrapOptions={{
        // NOT `initialFocus: false`: that option makes focus-trap-react
        // skip moving focus into the trap entirely instead of falling back
        // to the first tabbable node (the same failure mode fixed
        // elsewhere in this PR - see ThemeCatalogOnboarding.tsx). Many
        // Modal500 call sites (create-room, create-space, bug-report,
        // settings panels, etc.) may not have a focusable descendant ready
        // on the first render, so relying on `initialFocus: false` risked
        // leaving focus on whatever triggered the modal instead of inside
        // it. The Modal root has `tabIndex={-1}` below, so fallbackFocus
        // always resolves to it rather than `document.body`. Uses the
        // shared `focusTrapFallbackFocus` helper (see `$utils/dom`) which
        // is null-safe at runtime instead of casting the ref.
        fallbackFocus: focusTrapFallbackFocus(modalRef),
        clickOutsideDeactivates: true,
        onDeactivate: requestClose,
        escapeDeactivates: stopPropagation,
      }}
    >
      <Modal
        ref={modalRef}
        tabIndex={-1}
        size="500"
        variant="Background"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        style={
          useFullScreen
            ? {
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100dvh',
                maxWidth: '100vw',
                maxHeight: '100dvh',
                borderRadius: 0,
                paddingTop: 'var(--sable-safe-area-top, 0px)',
                overflow: 'hidden',
                backgroundColor: color.Background.Container,
              }
            : useSheet
              ? {
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '85dvh',
                  maxWidth: '100vw',
                  borderTopLeftRadius: config.radii.R400,
                  borderTopRightRadius: config.radii.R400,
                  overflow: 'hidden',
                  backgroundColor: color.Background.Container,
                }
              : undefined
        }
      >
        {children}
      </Modal>
    </FocusTrap>
  );

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      {useFullScreen || useSheet ? modal : <OverlayCenter>{modal}</OverlayCenter>}
    </Overlay>
  );
}
