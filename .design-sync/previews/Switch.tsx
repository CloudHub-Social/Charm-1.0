import { Switch, Box, Text } from 'folds';

const noop = () => {};

function Row({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Box direction="Row" gap="200" style={{ alignItems: 'center' }}>
      {children}
      <Text as="span" size="T300">{label}</Text>
    </Box>
  );
}

export function OnOffStates() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Enable notifications">
        <Switch variant="Primary" value onChange={noop} />
      </Row>
      <Row label="Show read receipts">
        <Switch variant="Primary" value={false} onChange={noop} />
      </Row>
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Primary">
        <Switch variant="Primary" value onChange={noop} />
      </Row>
      <Row label="Secondary">
        <Switch variant="Secondary" value onChange={noop} />
      </Row>
      <Row label="Success">
        <Switch variant="Success" value onChange={noop} />
      </Row>
      <Row label="Warning">
        <Switch variant="Warning" value onChange={noop} />
      </Row>
      <Row label="Critical">
        <Switch variant="Critical" value onChange={noop} />
      </Row>
    </Box>
  );
}

export function Disabled() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Row label="Mark as favourite (on)">
        <Switch variant="Primary" value onChange={noop} disabled />
      </Row>
      <Row label="Send typing indicators (off)">
        <Switch variant="Primary" value={false} onChange={noop} disabled />
      </Row>
    </Box>
  );
}
