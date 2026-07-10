import { Header, Box, Text, IconButton, Icon, Icons } from 'folds';

const bar = { borderBottom: '1px solid #e5e7eb', background: '#fafafa' } as const;

export function RoomHeader() {
  return (
    <Box direction="Column" style={{ width: 320, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <Header size="400" style={{ paddingLeft: 12, paddingRight: 4, background: '#fafafa' }}>
        <Box grow="Yes" alignItems="Center" gap="200">
          <Icon size="200" src={Icons.Hash} />
          <Text size="H5" truncate>general</Text>
        </Box>
        <IconButton size="300" radii="300">
          <Icon size="200" src={Icons.Search} />
        </IconButton>
        <IconButton size="300" radii="300">
          <Icon size="200" src={Icons.Info} />
        </IconButton>
      </Header>
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ width: 320 }}>
      <Header variant="Surface" size="400" style={{ ...bar, paddingLeft: 12, paddingRight: 12, borderRadius: 6 }}>
        <Box grow="Yes"><Text size="H6">Surface</Text></Box>
      </Header>
      <Header variant="SurfaceVariant" size="400" style={{ ...bar, paddingLeft: 12, paddingRight: 12, borderRadius: 6 }}>
        <Box grow="Yes"><Text size="H6">SurfaceVariant</Text></Box>
      </Header>
      <Header variant="Primary" size="400" style={{ background: '#e8ecfb', borderBottom: '1px solid #c7d2fe', paddingLeft: 12, paddingRight: 12, borderRadius: 6 }}>
        <Box grow="Yes"><Text size="H6">Primary</Text></Box>
      </Header>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" style={{ width: 320 }}>
      <Header variant="Surface" size="300" style={{ ...bar, paddingLeft: 12, paddingRight: 4, borderRadius: 6 }}>
        <Box grow="Yes" alignItems="Center"><Text size="H6">Small (300)</Text></Box>
        <IconButton size="300" radii="300"><Icon size="100" src={Icons.VerticalDots} /></IconButton>
      </Header>
      <Header variant="Surface" size="400" style={{ ...bar, paddingLeft: 12, paddingRight: 4, borderRadius: 6 }}>
        <Box grow="Yes" alignItems="Center"><Text size="H6">Medium (400)</Text></Box>
        <IconButton size="300" radii="300"><Icon size="200" src={Icons.VerticalDots} /></IconButton>
      </Header>
      <Header variant="Surface" size="500" style={{ ...bar, paddingLeft: 12, paddingRight: 4, borderRadius: 6 }}>
        <Box grow="Yes" alignItems="Center"><Text size="H5">Large (500)</Text></Box>
        <IconButton size="400" radii="300"><Icon size="200" src={Icons.VerticalDots} /></IconButton>
      </Header>
    </Box>
  );
}
