import { Box, IconButton, Icon, Icons } from 'folds';

export function Variants() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <IconButton variant="Primary">
        <Icon size="300" src={Icons.Send} />
      </IconButton>
      <IconButton variant="Secondary">
        <Icon size="300" src={Icons.Setting} />
      </IconButton>
      <IconButton variant="Success">
        <Icon size="300" src={Icons.Check} />
      </IconButton>
      <IconButton variant="Warning">
        <Icon size="300" src={Icons.Warning} />
      </IconButton>
      <IconButton variant="Critical">
        <Icon size="300" src={Icons.Delete} />
      </IconButton>
    </Box>
  );
}

export function Fills() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <IconButton variant="Primary" fill="Soft">
        <Icon size="300" src={Icons.Send} />
      </IconButton>
      <IconButton variant="Primary" fill="None">
        <Icon size="300" src={Icons.Send} />
      </IconButton>
      <IconButton variant="Primary" fill="None" outlined>
        <Icon size="300" src={Icons.Send} />
      </IconButton>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <IconButton variant="Primary" size="600">
        <Icon size="400" src={Icons.Bell} />
      </IconButton>
      <IconButton variant="Primary" size="500">
        <Icon size="400" src={Icons.Bell} />
      </IconButton>
      <IconButton variant="Primary" size="400">
        <Icon size="300" src={Icons.Bell} />
      </IconButton>
      <IconButton variant="Primary" size="300">
        <Icon size="200" src={Icons.Bell} />
      </IconButton>
    </Box>
  );
}

export function Radii() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <IconButton variant="Secondary" radii="Pill">
        <Icon size="300" src={Icons.Search} />
      </IconButton>
      <IconButton variant="Secondary" radii="400">
        <Icon size="300" src={Icons.Search} />
      </IconButton>
      <IconButton variant="Secondary" radii="0">
        <Icon size="300" src={Icons.Search} />
      </IconButton>
    </Box>
  );
}
