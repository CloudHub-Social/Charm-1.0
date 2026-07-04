import { PopOut, Menu, MenuItem, Box, Text, Icon, Icons } from 'folds';

// PopOut positions `content` (position: fixed) relative to an anchor rect and
// portals it to a container (default document.body = the card body here). We
// draw a matching anchor button at the same coordinates and re-apply the theme
// classes on the portalled content so it stays styled.
const THEME = 'oq6d071w _164xfge0 dw378b0';
const anchor = { x: 24, y: 24, width: 150, height: 34 };

export function DropdownMenu() {
  return (
    <Box style={{ position: 'relative', height: 260, width: '100%' }}>
      <Box
        style={{
          position: 'absolute', left: anchor.x, top: anchor.y,
          width: anchor.width, height: anchor.height,
          borderRadius: 6, background: '#e5e5e5',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text as="span" size="B300">Room options ▾</Text>
      </Box>
      <PopOut
        anchor={anchor}
        position="Bottom"
        align="Start"
        offset={6}
        content={
          <div className={THEME} style={{ fontFamily: "'Nunito Variable', sans-serif" }}>
            <Menu style={{ width: 190 }}>
              <Box direction="Column" style={{ padding: 4 }} gap="100">
                <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.Star} />}>
                  <Text as="span" size="T300">Favourite</Text>
                </MenuItem>
                <MenuItem size="300" radii="300" before={<Icon size="100" src={Icons.Bell} />}>
                  <Text as="span" size="T300">Notifications</Text>
                </MenuItem>
                <MenuItem size="300" radii="300" variant="Critical" fill="None" before={<Icon size="100" src={Icons.Delete} />}>
                  <Text as="span" size="T300">Leave room</Text>
                </MenuItem>
              </Box>
            </Menu>
          </div>
        }
      />
    </Box>
  );
}
