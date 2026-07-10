import { Text, Box } from 'folds';

export function Headings() {
  return (
    <Box direction="Column" gap="200" style={{ alignItems: 'flex-start' }}>
      <Text size="H1">Heading H1</Text>
      <Text size="H2">Heading H2</Text>
      <Text size="H3">Heading H3</Text>
      <Text size="H4">Heading H4</Text>
      <Text size="H5">Heading H5</Text>
      <Text size="H6">Heading H6</Text>
    </Box>
  );
}

export function BodyText() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start', maxWidth: 420 }}>
      <Text size="T400">
        The quick brown fox jumps over the lazy dog. This is body text at the
        default reading size, set in the design system&apos;s primary typeface.
      </Text>
      <Text size="T300">
        Smaller supporting text, useful for secondary information and captions
        beneath a primary message.
      </Text>
      <Text size="T200">
        The smallest body size, for timestamps and metadata.
      </Text>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="200" style={{ alignItems: 'flex-start' }}>
      <Text size="T500">T500 — large body</Text>
      <Text size="T400">T400 — default body</Text>
      <Text size="T300">T300 — small body</Text>
      <Text size="B400">B400 — button label</Text>
      <Text size="L400">L400 — label</Text>
      <Text size="O400">O400 — overline</Text>
      <Text size="C400">C400 — caption</Text>
    </Box>
  );
}

export function Alignment() {
  return (
    <Box direction="Column" gap="200" style={{ width: 320 }}>
      <Text size="T300" align="Left">Left aligned</Text>
      <Text size="T300" align="Center">Center aligned</Text>
      <Text size="T300" align="Right">Right aligned</Text>
    </Box>
  );
}

export function Truncated() {
  return (
    <Box direction="Column" gap="200" style={{ width: 240 }}>
      <Text size="T300" truncate>
        This line is quite long and will be truncated with an ellipsis when it
        overflows its container width.
      </Text>
    </Box>
  );
}
