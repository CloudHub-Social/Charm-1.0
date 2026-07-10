import { Spinner, Box, Text } from 'folds';

export function Sizes() {
  return (
    <Box gap="500" style={{ alignItems: 'center' }}>
      <Spinner variant="Primary" size="600" />
      <Spinner variant="Primary" size="500" />
      <Spinner variant="Primary" size="400" />
      <Spinner variant="Primary" size="300" />
    </Box>
  );
}

export function Variants() {
  return (
    <Box gap="500" style={{ alignItems: 'center' }}>
      <Spinner variant="Primary" size="500" />
      <Spinner variant="Secondary" size="500" />
      <Spinner variant="Success" size="500" />
      <Spinner variant="Warning" size="500" />
      <Spinner variant="Critical" size="500" />
    </Box>
  );
}

export function Fills() {
  return (
    <Box gap="500" style={{ alignItems: 'center' }}>
      <Spinner variant="Primary" fill="Solid" size="500" />
      <Spinner variant="Primary" fill="Soft" size="500" />
    </Box>
  );
}

export function InlineLoading() {
  return (
    <Box gap="200" style={{ alignItems: 'center' }}>
      <Spinner variant="Secondary" size="300" />
      <Text as="span" size="T300">Loading messages…</Text>
    </Box>
  );
}
