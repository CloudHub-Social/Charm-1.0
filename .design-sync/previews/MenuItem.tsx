import { MenuItem, Box, Text, Icon, Icons } from 'folds';

export function Variants() {
  return (
    <Box direction="Column" gap="100" style={{ width: 220 }}>
      <MenuItem variant="Surface" radii="300"><Text as="span" size="T300">Surface item</Text></MenuItem>
      <MenuItem variant="Primary" radii="300"><Text as="span" size="T300">Primary item</Text></MenuItem>
      <MenuItem variant="Success" radii="300"><Text as="span" size="T300">Success item</Text></MenuItem>
      <MenuItem variant="Critical" radii="300"><Text as="span" size="T300">Critical item</Text></MenuItem>
    </Box>
  );
}

export function WithIcons() {
  return (
    <Box direction="Column" gap="100" style={{ width: 220 }}>
      <MenuItem variant="Surface" radii="300" before={<Icon size="100" src={Icons.ReplyArrow} />}>
        <Text as="span" size="T300">Reply</Text>
      </MenuItem>
      <MenuItem variant="Surface" radii="300" before={<Icon size="100" src={Icons.Pin} />} after={<Text as="span" size="T200">⌘P</Text>}>
        <Text as="span" size="T300">Pin message</Text>
      </MenuItem>
      <MenuItem variant="Critical" fill="None" radii="300" before={<Icon size="100" src={Icons.Delete} />}>
        <Text as="span" size="T300">Delete</Text>
      </MenuItem>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="100" style={{ width: 220 }}>
      <MenuItem variant="Surface" size="400" radii="300"><Text as="span" size="T300">Size 400</Text></MenuItem>
      <MenuItem variant="Surface" size="300" radii="300"><Text as="span" size="T200">Size 300</Text></MenuItem>
    </Box>
  );
}
