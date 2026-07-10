import { Box, Line, Text } from 'folds';

export function Horizontal() {
  return (
    <Box direction="Column" gap="300" style={{ width: 260 }}>
      <Text size="T400">General</Text>
      <Line variant="Surface" size="300" direction="Horizontal" />
      <Text size="T400">Notifications</Text>
      <Line variant="Surface" size="300" direction="Horizontal" />
      <Text size="T400">Appearance</Text>
    </Box>
  );
}

export function Vertical() {
  return (
    <Box direction="Row" gap="300" style={{ alignItems: 'center', height: 40 }}>
      <Text as="span" size="T300">Reply</Text>
      <Line variant="Surface" size="300" direction="Vertical" style={{ height: 24 }} />
      <Text as="span" size="T300">Forward</Text>
      <Line variant="Surface" size="300" direction="Vertical" style={{ height: 24 }} />
      <Text as="span" size="T300">Delete</Text>
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="400" style={{ width: 260 }}>
      <Line variant="Surface" size="500" direction="Horizontal" />
      <Line variant="Primary" size="500" direction="Horizontal" />
      <Line variant="Success" size="500" direction="Horizontal" />
      <Line variant="Warning" size="500" direction="Horizontal" />
      <Line variant="Critical" size="500" direction="Horizontal" />
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="400" style={{ width: 260 }}>
      <Line variant="Primary" size="300" direction="Horizontal" />
      <Line variant="Primary" size="500" direction="Horizontal" />
      <Line variant="Primary" size="700" direction="Horizontal" />
    </Box>
  );
}
