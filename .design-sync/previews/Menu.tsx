import { Menu, MenuItem, Box, Text, Icon, Icons, Line } from 'folds';

export function MessageActions() {
  return (
    <Menu style={{ width: 220 }}>
      <Box direction="Column" style={{ padding: 4 }} gap="100">
        <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.ReplyArrow} />}>
          <Text as="span" size="T300">Reply</Text>
        </MenuItem>
        <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.Smile} />}>
          <Text as="span" size="T300">Add reaction</Text>
        </MenuItem>
        <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.Pin} />}>
          <Text as="span" size="T300">Pin message</Text>
        </MenuItem>
        <Line size="300" style={{ margin: '4px 0' }} />
        <MenuItem size="300" radii="300" variant="Critical" fill="None" before={<Icon size="100" src={Icons.Delete} />}>
          <Text as="span" size="T300">Delete</Text>
        </MenuItem>
      </Box>
    </Menu>
  );
}

export function RoomOptions() {
  return (
    <Menu style={{ width: 220 }}>
      <Box direction="Column" style={{ padding: 4 }} gap="100">
        <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.Star} />}>
          <Text as="span" size="T300">Mark as favourite</Text>
        </MenuItem>
        <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.Bell} />}>
          <Text as="span" size="T300">Notifications</Text>
        </MenuItem>
        <MenuItem size="300" radii="300" aria-selected before={<Icon size="100" src={Icons.Info} />}>
          <Text as="span" size="T300">Room info</Text>
        </MenuItem>
      </Box>
    </Menu>
  );
}
