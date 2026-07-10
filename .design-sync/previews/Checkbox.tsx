import { Checkbox, Box, Text } from 'folds';

function Row({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Box direction="Row" gap="200" style={{ alignItems: 'center' }}>
      {children}
      <Text as="span" size="T300">{label}</Text>
    </Box>
  );
}

export function CheckedStates() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Enable notifications">
        <Checkbox variant="Primary" defaultChecked />
      </Row>
      <Row label="Show read receipts">
        <Checkbox variant="Primary" />
      </Row>
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Primary">
        <Checkbox variant="Primary" defaultChecked />
      </Row>
      <Row label="Secondary">
        <Checkbox variant="Secondary" defaultChecked />
      </Row>
      <Row label="Success">
        <Checkbox variant="Success" defaultChecked />
      </Row>
      <Row label="Warning">
        <Checkbox variant="Warning" defaultChecked />
      </Row>
      <Row label="Critical">
        <Checkbox variant="Critical" defaultChecked />
      </Row>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Large">
        <Checkbox variant="Primary" size="500" defaultChecked />
      </Row>
      <Row label="Medium">
        <Checkbox variant="Primary" size="400" defaultChecked />
      </Row>
      <Row label="Small">
        <Checkbox variant="Primary" size="300" defaultChecked />
      </Row>
    </Box>
  );
}

export function Disabled() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Mark as favourite (on)">
        <Checkbox variant="Primary" defaultChecked disabled />
      </Row>
      <Row label="Send typing indicators (off)">
        <Checkbox variant="Primary" disabled />
      </Row>
    </Box>
  );
}
