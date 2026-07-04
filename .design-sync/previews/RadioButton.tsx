import { RadioButton, Box, Text } from 'folds';

function Row({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Box direction="Row" gap="200" style={{ alignItems: 'center' }}>
      {children}
      <Text as="span" size="T300">{label}</Text>
    </Box>
  );
}

export function SelectedStates() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="All new messages">
        <RadioButton variant="Primary" defaultChecked />
      </Row>
      <Row label="Mentions only">
        <RadioButton variant="Primary" />
      </Row>
      <Row label="Nothing">
        <RadioButton variant="Primary" />
      </Row>
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Primary">
        <RadioButton variant="Primary" defaultChecked />
      </Row>
      <Row label="Secondary">
        <RadioButton variant="Secondary" defaultChecked />
      </Row>
      <Row label="Success">
        <RadioButton variant="Success" defaultChecked />
      </Row>
      <Row label="Warning">
        <RadioButton variant="Warning" defaultChecked />
      </Row>
      <Row label="Critical">
        <RadioButton variant="Critical" defaultChecked />
      </Row>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Large">
        <RadioButton variant="Primary" size="500" defaultChecked />
      </Row>
      <Row label="Medium">
        <RadioButton variant="Primary" size="400" defaultChecked />
      </Row>
      <Row label="Small">
        <RadioButton variant="Primary" size="300" defaultChecked />
      </Row>
    </Box>
  );
}

export function Disabled() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Use system theme (on)">
        <RadioButton variant="Primary" defaultChecked disabled />
      </Row>
      <Row label="Always dark (off)">
        <RadioButton variant="Primary" disabled />
      </Row>
    </Box>
  );
}
