import { Badge, Box, Text } from 'folds';

export function Variants() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Badge variant="Primary" fill="Solid"><Text as="span" size="L400">Primary</Text></Badge>
      <Badge variant="Secondary" fill="Solid"><Text as="span" size="L400">Secondary</Text></Badge>
      <Badge variant="Success" fill="Solid"><Text as="span" size="L400">Success</Text></Badge>
      <Badge variant="Warning" fill="Solid"><Text as="span" size="L400">Warning</Text></Badge>
      <Badge variant="Critical" fill="Solid"><Text as="span" size="L400">Critical</Text></Badge>
    </Box>
  );
}

export function Fills() {
  return (
    <Box gap="200" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Badge variant="Primary" fill="Solid"><Text as="span" size="L400">Solid</Text></Badge>
      <Badge variant="Primary" fill="Soft"><Text as="span" size="L400">Soft</Text></Badge>
      <Badge variant="Primary" fill="None" outlined><Text as="span" size="L400">Outlined</Text></Badge>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box gap="300" wrap="Wrap" style={{ alignItems: 'center' }}>
      <Badge variant="Critical" fill="Solid" radii="Pill" size="500"><Text as="span" size="L400">9</Text></Badge>
      <Badge variant="Critical" fill="Solid" radii="Pill" size="400"><Text as="span" size="L400">9</Text></Badge>
      <Badge variant="Critical" fill="Solid" radii="Pill" size="300"><Text as="span" size="L400">9</Text></Badge>
      <Badge variant="Critical" fill="Solid" radii="Pill" size="200" />
    </Box>
  );
}

export function NotificationDots() {
  return (
    <Box gap="400" style={{ alignItems: 'center' }}>
      <Badge variant="Primary" fill="Solid" radii="Pill" size="400"><Text as="span" size="L400">12</Text></Badge>
      <Badge variant="Critical" fill="Solid" radii="Pill" size="400"><Text as="span" size="L400">99+</Text></Badge>
      <Badge variant="Success" fill="Solid" radii="Pill" size="300"><Text as="span" size="L400">New</Text></Badge>
    </Box>
  );
}
