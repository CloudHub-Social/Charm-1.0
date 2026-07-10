import { ProgressBar, Box, Text } from 'folds';

export function FillLevels() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Box direction="Column" gap="100" style={{ width: 240 }}>
        <Text as="span" size="T200">Uploading — 25%</Text>
        <ProgressBar variant="Primary" min={0} max={100} value={25} style={{ width: 240 }} />
      </Box>
      <Box direction="Column" gap="100" style={{ width: 240 }}>
        <Text as="span" size="T200">Uploading — 50%</Text>
        <ProgressBar variant="Primary" min={0} max={100} value={50} style={{ width: 240 }} />
      </Box>
      <Box direction="Column" gap="100" style={{ width: 240 }}>
        <Text as="span" size="T200">Uploading — 90%</Text>
        <ProgressBar variant="Primary" min={0} max={100} value={90} style={{ width: 240 }} />
      </Box>
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <ProgressBar variant="Primary" min={0} max={100} value={65} style={{ width: 240 }} />
      <ProgressBar variant="Secondary" min={0} max={100} value={65} style={{ width: 240 }} />
      <ProgressBar variant="Success" min={0} max={100} value={65} style={{ width: 240 }} />
      <ProgressBar variant="Warning" min={0} max={100} value={65} style={{ width: 240 }} />
      <ProgressBar variant="Critical" min={0} max={100} value={65} style={{ width: 240 }} />
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <ProgressBar variant="Primary" size="500" min={0} max={100} value={70} style={{ width: 240 }} />
      <ProgressBar variant="Primary" size="400" min={0} max={100} value={70} style={{ width: 240 }} />
      <ProgressBar variant="Primary" size="300" min={0} max={100} value={70} style={{ width: 240 }} />
    </Box>
  );
}

export function Complete() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Box direction="Column" gap="100" style={{ width: 240 }}>
        <Text as="span" size="T200">Download complete</Text>
        <ProgressBar variant="Success" min={0} max={100} value={100} style={{ width: 240 }} />
      </Box>
    </Box>
  );
}
