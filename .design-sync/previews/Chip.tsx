import { Chip, Box, Text, Icon, Icons } from 'folds';

export function Variants() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Chip variant="Primary" fill="Soft"><Text as="span" size="T300">Primary</Text></Chip>
      <Chip variant="Secondary" fill="Soft"><Text as="span" size="T300">Secondary</Text></Chip>
      <Chip variant="Success" fill="Soft"><Text as="span" size="T300">Success</Text></Chip>
      <Chip variant="Warning" fill="Soft"><Text as="span" size="T300">Warning</Text></Chip>
      <Chip variant="Critical" fill="Soft"><Text as="span" size="T300">Critical</Text></Chip>
    </Box>
  );
}

export function Fills() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Chip variant="Primary" fill="Soft"><Text as="span" size="T300">Soft</Text></Chip>
      <Chip variant="Primary" fill="None" outlined><Text as="span" size="T300">Outlined</Text></Chip>
      <Chip variant="SurfaceVariant" fill="Soft"><Text as="span" size="T300">Surface variant</Text></Chip>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Chip variant="Secondary" fill="Soft" size="500"><Text as="span" size="T300">Large</Text></Chip>
      <Chip variant="Secondary" fill="Soft" size="400"><Text as="span" size="T300">Medium</Text></Chip>
    </Box>
  );
}

export function RoomTags() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Chip variant="SurfaceVariant" fill="Soft" radii="Pill" before={<Icon size="100" src={Icons.Hash} />}>
        <Text as="span" size="T300">general</Text>
      </Chip>
      <Chip variant="SurfaceVariant" fill="Soft" radii="Pill" before={<Icon size="100" src={Icons.HashLock} />}>
        <Text as="span" size="T300">private-dev</Text>
      </Chip>
      <Chip variant="Warning" fill="Soft" radii="Pill" before={<Icon size="100" src={Icons.BellMute} />}>
        <Text as="span" size="T300">Muted</Text>
      </Chip>
      <Chip variant="Success" fill="Soft" radii="Pill" before={<Icon size="100" src={Icons.User} />}>
        <Text as="span" size="T300">5 online</Text>
      </Chip>
    </Box>
  );
}

export function RemovableFilters() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Chip variant="Primary" fill="Soft" radii="Pill" after={<Icon size="100" src={Icons.Cross} />}>
        <Text as="span" size="T300">Unread</Text>
      </Chip>
      <Chip variant="Primary" fill="Soft" radii="Pill" after={<Icon size="100" src={Icons.Cross} />}>
        <Text as="span" size="T300">Mentions</Text>
      </Chip>
      <Chip variant="Secondary" fill="None" outlined radii="Pill" before={<Icon size="100" src={Icons.Plus} />}>
        <Text as="span" size="T300">Add filter</Text>
      </Chip>
    </Box>
  );
}
