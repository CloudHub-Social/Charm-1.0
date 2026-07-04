import { Button, Box, Text, Icon, Icons } from 'folds';

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Button variant="Primary" fill="Solid">
        <Text as="span" size="B400">Send message</Text>
      </Button>
      <Button variant="Secondary" fill="Solid">
        <Text as="span" size="B400">Secondary</Text>
      </Button>
      <Button variant="Success" fill="Solid">
        <Text as="span" size="B400">Save changes</Text>
      </Button>
      <Button variant="Warning" fill="Solid">
        <Text as="span" size="B400">Review</Text>
      </Button>
      <Button variant="Critical" fill="Solid">
        <Text as="span" size="B400">Delete room</Text>
      </Button>
    </Box>
  );
}

export function Fills() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Button variant="Primary" fill="Solid">
        <Text as="span" size="B400">Solid</Text>
      </Button>
      <Button variant="Primary" fill="Soft">
        <Text as="span" size="B400">Soft</Text>
      </Button>
      <Button variant="Primary" fill="None" outlined>
        <Text as="span" size="B400">Outlined</Text>
      </Button>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Button variant="Primary" size="500">
        <Text as="span" size="B500">Large</Text>
      </Button>
      <Button variant="Primary" size="400">
        <Text as="span" size="B400">Medium</Text>
      </Button>
      <Button variant="Primary" size="300">
        <Text as="span" size="B300">Small</Text>
      </Button>
    </Box>
  );
}

export function WithIcons() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Button variant="Primary" before={<Icon size="200" src={Icons.Send} />}>
        <Text as="span" size="B400">Send</Text>
      </Button>
      <Button variant="Secondary" fill="Soft" after={<Icon size="200" src={Icons.ChevronRight} />}>
        <Text as="span" size="B400">Next</Text>
      </Button>
      <Button variant="Critical" fill="Soft" before={<Icon size="200" src={Icons.Delete} />}>
        <Text as="span" size="B400">Delete</Text>
      </Button>
    </Box>
  );
}

export function Disabled() {
  return (
    <Box direction="Column" gap="300" style={{ alignItems: 'flex-start' }}>
      <Button variant="Primary" disabled>
        <Text as="span" size="B400">Disabled primary</Text>
      </Button>
      <Button variant="Secondary" fill="Soft" disabled>
        <Text as="span" size="B400">Disabled soft</Text>
      </Button>
    </Box>
  );
}
