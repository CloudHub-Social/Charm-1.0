import { Modal, Box, Text, Button, IconButton, Icon, Icons, Line } from 'folds';

export function RoomSettings() {
  return (
    <Modal variant="Surface" size="400" style={{ width: 380 }}>
      <Box direction="Column">
        <Box style={{ padding: '16px 20px' }} justifyContent="SpaceBetween" alignItems="Center">
          <Text size="H4">Room settings</Text>
          <IconButton size="300" variant="Surface" fill="None"><Icon size="200" src={Icons.Cross} /></IconButton>
        </Box>
        <Line size="300" />
        <Box direction="Column" style={{ padding: 20 }} gap="300">
          <Text size="T300" priority="400">
            Configure how this room behaves. Changes apply to everyone in
            <b> #general</b>.
          </Text>
          <Box gap="200" justifyContent="End">
            <Button variant="Secondary" fill="Soft" size="300"><Text as="span" size="B300">Cancel</Text></Button>
            <Button variant="Primary" fill="Solid" size="300"><Text as="span" size="B300">Save</Text></Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" alignItems="Start">
      <Modal variant="Surface" size="500" style={{ width: 220 }}>
        <Box style={{ padding: 16 }}><Text size="T300">Size 500</Text></Box>
      </Modal>
      <Modal variant="Surface" size="400" style={{ width: 220 }}>
        <Box style={{ padding: 16 }}><Text size="T300">Size 400</Text></Box>
      </Modal>
      <Modal variant="Surface" size="300" style={{ width: 220 }}>
        <Box style={{ padding: 16 }}><Text size="T300">Size 300</Text></Box>
      </Modal>
    </Box>
  );
}
