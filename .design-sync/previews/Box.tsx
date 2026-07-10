import { Box, Text } from 'folds';

const cell = { background: '#e5e5e5', padding: 12, borderRadius: 6, minWidth: 40, textAlign: 'center' as const };

function Item({ label }: { label: string }) {
  return (
    <div style={cell}>
      <Text as="span" size="T300">{label}</Text>
    </div>
  );
}

export function Row() {
  return (
    <Box direction="Row" gap="300" style={{ alignItems: 'center' }}>
      <Item label="One" />
      <Item label="Two" />
      <Item label="Three" />
    </Box>
  );
}

export function Column() {
  return (
    <Box direction="Column" gap="200" style={{ alignItems: 'flex-start' }}>
      <Item label="First" />
      <Item label="Second" />
      <Item label="Third" />
    </Box>
  );
}

export function Gaps() {
  return (
    <Box direction="Column" gap="400" style={{ alignItems: 'flex-start' }}>
      <Box direction="Row" gap="100"><Item label="A" /><Item label="B" /><Item label="C" /></Box>
      <Box direction="Row" gap="300"><Item label="A" /><Item label="B" /><Item label="C" /></Box>
      <Box direction="Row" gap="500"><Item label="A" /><Item label="B" /><Item label="C" /></Box>
    </Box>
  );
}

export function JustifyContent() {
  return (
    <Box direction="Column" gap="300" style={{ width: 280 }}>
      <Box direction="Row" gap="200" justifyContent="Start" style={{ background: '#f3f4f6', padding: 6, borderRadius: 6 }}>
        <Item label="Start" />
      </Box>
      <Box direction="Row" gap="200" justifyContent="Center" style={{ background: '#f3f4f6', padding: 6, borderRadius: 6 }}>
        <Item label="Center" />
      </Box>
      <Box direction="Row" gap="200" justifyContent="SpaceBetween" style={{ background: '#f3f4f6', padding: 6, borderRadius: 6 }}>
        <Item label="Space" />
        <Item label="Between" />
      </Box>
    </Box>
  );
}

export function AlignItems() {
  return (
    <Box direction="Row" gap="300">
      <Box direction="Row" alignItems="Start" style={{ background: '#f3f4f6', padding: 6, borderRadius: 6, height: 90 }}>
        <Item label="Start" />
      </Box>
      <Box direction="Row" alignItems="Center" style={{ background: '#f3f4f6', padding: 6, borderRadius: 6, height: 90 }}>
        <Item label="Center" />
      </Box>
      <Box direction="Row" alignItems="End" style={{ background: '#f3f4f6', padding: 6, borderRadius: 6, height: 90 }}>
        <Item label="End" />
      </Box>
    </Box>
  );
}

export function Grow() {
  return (
    <Box direction="Row" gap="200" style={{ width: 280 }}>
      <div style={cell}><Text as="span" size="T300">Fixed</Text></div>
      <Box grow="Yes" style={{ background: '#c7d2fe', padding: 12, borderRadius: 6, textAlign: 'center' }}>
        <Text as="span" size="T300">grow=Yes</Text>
      </Box>
    </Box>
  );
}
