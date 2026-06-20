import type { ReactNode } from "react";
import { useRef } from "react";
import FocusTrap from "focus-trap-react";
import { Modal, Overlay, OverlayBackdrop, OverlayCenter } from "folds";
import { ScreenSize, useScreenSizeContext } from "$hooks/useScreenSize";
import { mobileOrTabletLayout } from "$utils/user-agent";
import { stopPropagation } from "$utils/keyboard";

type Modal500Props = {
  fullScreenOnMobile?: boolean;
  requestClose: () => void;
  children: ReactNode;
};
export function Modal500({
  requestClose,
  children,
  fullScreenOnMobile = false,
}: Modal500Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile || mobileOrTabletLayout();
  const useFullScreen = fullScreenOnMobile && isMobile;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
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
            style={
              useFullScreen
                ? {
                    position: "fixed",
                    top: "var(--sable-safe-area-top, 0px)",
                    right: "var(--sable-safe-area-right, 0px)",
                    bottom:
                      "var(--sable-safe-area-bottom-raw, var(--sable-safe-area-bottom, 0px))",
                    left: "var(--sable-safe-area-left, 0px)",
                    width: "auto",
                    height: "auto",
                    minHeight: 0,
                    maxHeight: "none",
                    maxWidth: "none",
                    margin: 0,
                    borderRadius: 0,
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {children}
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
