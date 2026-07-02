import { useCallback, useEffect, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  config,
  Dialog,
  Header,
  IconButton,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
} from 'folds';
import { menuIcon, X } from '$components/icons/phosphor';

import { stopPropagation } from '$utils/keyboard';
import { focusTrapFallbackFocus } from '$utils/dom';

type ThemeCatalogOnboardingProps = {
  open: boolean;
  onEnable: () => void;
  onDecline: () => void;
};

const THEME_CATALOG_ONBOARDING_TITLE_ID = 'theme-catalog-onboarding-title';

export function ThemeCatalogOnboarding({ open, onEnable, onDecline }: ThemeCatalogOnboardingProps) {
  const suppressDeactivateDecline = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const handleEnableClick = useCallback(() => {
    suppressDeactivateDecline.current = true;
    onEnable();
  }, [onEnable]);

  const handleDeclineClick = useCallback(() => {
    suppressDeactivateDecline.current = true;
    onDecline();
  }, [onDecline]);

  const handleTrapDeactivate = useCallback(() => {
    if (suppressDeactivateDecline.current) {
      suppressDeactivateDecline.current = false;
      return;
    }
    onDecline();
  }, [onDecline]);

  return (
    <Overlay open={open} backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            // Deliberately NOT `initialFocus: false` here: that option makes
            // focus-trap-react skip moving focus into the trap entirely (it
            // returns early instead of falling back to the first tabbable
            // node), which left focus on <body> and let the fully-obscured
            // Settings controls behind the backdrop stay in the tab order.
            // Falling back to the dialog root keeps us safe if the dialog
            // body ever renders without a focusable descendant. The dialog
            // root has `tabIndex={-1}`, so it's always programmatically
            // focusable here; never fall back to `document.body`. Uses the
            // shared `focusTrapFallbackFocus` helper (see `$utils/dom`) which
            // is null-safe at runtime instead of casting the ref.
            fallbackFocus: focusTrapFallbackFocus(dialogRef),
            onDeactivate: handleTrapDeactivate,
            clickOutsideDeactivates: false,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog
            ref={dialogRef}
            tabIndex={-1}
            variant="Surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby={THEME_CATALOG_ONBOARDING_TITLE_ID}
          >
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text id={THEME_CATALOG_ONBOARDING_TITLE_ID} size="H4">
                  Remote themes
                </Text>
              </Box>
              <IconButton
                size="300"
                variant="Secondary"
                fill="Soft"
                outlined
                radii="300"
                onClick={handleDeclineClick}
                aria-label="Close"
              >
                {menuIcon(X)}
              </IconButton>
            </Header>
            <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
              <Text priority="400">
                Load themes from the Sable-compatible theme catalog on GitHub? You can browse
                previews, save favorites locally, and sync them with light and dark mode. If you
                choose not to, you can keep using the built-in Light and Dark themes only.
              </Text>
              <Box direction="Column" gap="200">
                <Button
                  variant="Primary"
                  fill="Soft"
                  outlined
                  size="300"
                  radii="300"
                  onClick={handleEnableClick}
                >
                  <Text size="B400">Yes, use the catalog</Text>
                </Button>
                <Button
                  variant="Secondary"
                  fill="Soft"
                  outlined
                  size="300"
                  radii="300"
                  onClick={handleDeclineClick}
                >
                  <Text size="B400">No, built-in themes only</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

export function useThemeCatalogOnboardingGate(
  onboardingDone: boolean,
  onComplete: (enabled: boolean) => void
) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!onboardingDone) {
      setOpen(true);
    }
  }, [onboardingDone]);

  const handleEnable = useCallback(() => {
    setOpen(false);
    onComplete(true);
  }, [onComplete]);

  const handleDecline = useCallback(() => {
    setOpen(false);
    onComplete(false);
  }, [onComplete]);

  const openOnboarding = useCallback(() => {
    setOpen(true);
  }, []);

  return {
    open,
    openOnboarding,
    dialog: (
      <ThemeCatalogOnboarding open={open} onEnable={handleEnable} onDecline={handleDecline} />
    ),
  };
}
