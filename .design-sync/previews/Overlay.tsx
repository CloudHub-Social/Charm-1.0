import { Overlay, OverlayBackdrop, OverlayCenter, Dialog, Box, Text, Button } from 'folds';

// Overlay portals its children into a container (default = document.body). In a
// preview card the card body IS that container, so an open overlay fills the
// card. We re-apply the theme classes on the overlay content so it stays styled
// after portalling out of the provider wrapper.
const THEME = 'oq6d071w _164xfge0 dw378b0';

export function OpenWithBackdrop() {
  return (
    <Box style={{ height: 300, width: '100%' }}>
      <Overlay open backdrop={<OverlayBackdrop />}>
        <div className={THEME} style={{ fontFamily: "'Nunito Variable', sans-serif" }}>
          <OverlayCenter>
            <Dialog variant="Surface" style={{ width: 300 }}>
              <Box direction="Column" style={{ padding: 24 }} gap="400">
                <Text size="H4">Leave room?</Text>
                <Text size="T300" priority="300">
                  You&apos;ll stop receiving messages from <b>#general</b>.
                </Text>
                <Box gap="200" justifyContent="End">
                  <Button variant="Secondary" fill="Soft" size="300"><Text as="span" size="B300">Cancel</Text></Button>
                  <Button variant="Critical" fill="Solid" size="300"><Text as="span" size="B300">Leave</Text></Button>
                </Box>
              </Box>
            </Dialog>
          </OverlayCenter>
        </div>
      </Overlay>
    </Box>
  );
}
