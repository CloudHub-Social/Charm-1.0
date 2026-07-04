import { Input, Box, Text, Icon, Icons } from 'folds';

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ width: 280 }}>
      <Input variant="Background" placeholder="Background" defaultValue="Background" />
      <Input variant="Surface" placeholder="Surface" defaultValue="Surface" />
      <Input variant="SurfaceVariant" placeholder="Surface variant" defaultValue="Surface variant" />
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Column" gap="300" style={{ width: 280 }}>
      <Input variant="Surface" outlined size="500" placeholder="Large" defaultValue="Large input" />
      <Input variant="Surface" outlined size="400" placeholder="Medium" defaultValue="Medium input" />
      <Input variant="Surface" outlined size="300" placeholder="Small" defaultValue="Small input" />
    </Box>
  );
}

export function WithIcons() {
  return (
    <Box direction="Column" gap="300" style={{ width: 280 }}>
      <Input
        variant="Surface"
        before={<Icon size="200" src={Icons.Search} />}
        placeholder="Search rooms"
      />
      <Input
        variant="Surface"
        before={<Icon size="200" src={Icons.User} />}
        after={<Icon size="200" src={Icons.Check} />}
        defaultValue="@evie:cloudhub.social"
      />
    </Box>
  );
}

export function States() {
  return (
    <Box direction="Column" gap="300" style={{ width: 280 }}>
      <Input variant="Surface" placeholder="Placeholder only" />
      <Input variant="Surface" outlined placeholder="Outlined" defaultValue="Outlined" />
      <Input variant="Critical" outlined defaultValue="Invalid value" />
      <Input variant="Surface" disabled defaultValue="Disabled" />
    </Box>
  );
}
