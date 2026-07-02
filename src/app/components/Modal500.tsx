import type { ReactNode } from 'react';
import { useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { Modal, Overlay, OverlayBackdrop, OverlayCenter, color, config } from 'folds';
import { ScreenSize, useScreenSizeContext } from '$hooks/useScreenSize';
import { isPhoneLayoutDevice } from '$utils/user-agent';
import { stopPropagation } from '$utils/keyboard';

type Modal500Props = {
  fullScreenOnMobile?: boolean;
  sheetOnMobile?: boolean;
  requestClose: () => void;
  children: ReactNode;
};
export function Modal500({
  requestClose,
  children,
  fullScreenOnMobile = false,
  sheetOnMobile = false,
}: Modal500Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile || isPhoneLayoutDevice();
  const useFullScreen = fullScreenOnMobile && isMobile;
  const useSheet = sheetOnMobile && isMobile && !useFullScreen;
  const modal = (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: false,
        fallbackFocus: () => modalRef.current ?? document.body,
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
