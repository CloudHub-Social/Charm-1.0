import { Tooltip, Box, Text } from 'folds';

export function Variants() {
  return (
    <Box gap="400" wrap="Wrap" alignItems="Center" style={{ padding: 8 }}>
      <Tooltip variant="Surface"><Text as="span" size="T200">Surface tooltip</Text></Tooltip>
      <Tooltip variant="Primary"><Text as="span" size="T200">Primary</Text></Tooltip>
      <Tooltip variant="Critical"><Text as="span" size="T200">Critical</Text></Tooltip>
    </Box>
  );
}

export function Content() {
  return (
    <Box direction="Column" gap="400" alignItems="Start" style={{ padding: 8 }}>
      <Tooltip variant="Surface"><Text as="span" size="T200">Copy to clipboard</Text></Tooltip>
      <Tooltip variant="Surface" radii="Pill"><Text as="span" size="T200">@evie:cloudhub.social</Text></Tooltip>
      <Tooltip variant="Secondary"><Text as="span" size="T200">Sent · 12:04</Text></Tooltip>
    </Box>
  );
}
