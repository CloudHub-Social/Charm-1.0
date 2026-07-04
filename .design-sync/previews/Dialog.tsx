import { Dialog, Box, Text, Button, Line } from 'folds';

export function ConfirmLeave() {
  return (
    <Dialog variant="Surface" style={{ width: 340 }}>
      <Box direction="Column" style={{ padding: 24 }} gap="400">
        <Box direction="Column" gap="200">
          <Text size="H4">Leave room?</Text>
          <Text size="T300" priority="300">
            Are you sure you want to leave <b>#general</b>? You will stop
            receiving messages and need an invite to rejoin.
          </Text>
        </Box>
        <Box gap="200" justifyContent="End">
          <Button variant="Secondary" fill="Soft" size="300"><Text as="span" size="B300">Cancel</Text></Button>
          <Button variant="Critical" fill="Solid" size="300"><Text as="span" size="B300">Leave room</Text></Button>
        </Box>
      </Box>
    </Dialog>
  );
}

export function FormDialog() {
  return (
    <Dialog variant="Surface" style={{ width: 340 }}>
      <Box direction="Column" style={{ padding: 24 }} gap="400">
        <Text size="H4">Create room</Text>
        <Line size="300" />
        <Box direction="Column" gap="100">
          <Text size="L400" priority="300">ROOM NAME</Text>
          <Text size="T300">Weekend plans</Text>
        </Box>
        <Box gap="200" justifyContent="End">
          <Button variant="Secondary" fill="Soft" size="300"><Text as="span" size="B300">Cancel</Text></Button>
          <Button variant="Primary" fill="Solid" size="300"><Text as="span" size="B300">Create</Text></Button>
        </Box>
      </Box>
    </Dialog>
  );
}
