import { OverlayCenter, Modal, Dialog, Box, Text, Button } from 'folds';

export function CenteredDialog() {
  return (
    <Box style={{ position: 'relative', height: 260, width: '100%', background: 'rgba(0,0,0,0.35)', borderRadius: 8 }}>
      <OverlayCenter style={{ width: '100%' }}>
        <Dialog variant="Surface" style={{ width: 300 }}>
          <Box direction="Column" style={{ padding: 24 }} gap="400">
            <Text size="H4">Delete message?</Text>
            <Text size="T300" priority="300">This can&apos;t be undone.</Text>
            <Box gap="200" justifyContent="End">
              <Button variant="Secondary" fill="Soft" size="300"><Text as="span" size="B300">Cancel</Text></Button>
              <Button variant="Critical" fill="Solid" size="300"><Text as="span" size="B300">Delete</Text></Button>
            </Box>
          </Box>
        </Dialog>
      </OverlayCenter>
    </Box>
  );
}

export function CenteredModal() {
  return (
    <Box style={{ position: 'relative', height: 220, width: '100%', background: 'rgba(0,0,0,0.35)', borderRadius: 8 }}>
      <OverlayCenter style={{ width: '100%' }}>
        <Modal variant="Surface" size="400" style={{ width: 260 }}>
          <Box direction="Column" style={{ padding: 20 }} gap="200">
            <Text size="H5">Connecting…</Text>
            <Text size="T300" priority="300">Restoring your session.</Text>
          </Box>
        </Modal>
      </OverlayCenter>
    </Box>
  );
}
