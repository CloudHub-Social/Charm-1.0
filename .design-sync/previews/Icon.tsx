import { Box, Icon, Icons } from 'folds';

export function Grid() {
  const names = [
    'Home', 'Message', 'Send', 'Search', 'Bell', 'Setting',
    'User', 'UserPlus', 'Hash', 'Space', 'Pin', 'Bookmark',
    'Phone', 'VideoCamera', 'Mic', 'Photo', 'Attachment', 'Smile',
    'Check', 'Cross', 'Delete', 'Star', 'Heart', 'Globe',
  ] as const;
  return (
    <Box direction="Row" wrap="Wrap" gap="400" alignItems="Center">
      {names.map((name) => (
        <Icon key={name} size="400" src={Icons[name]} />
      ))}
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Row" wrap="Wrap" gap="400" alignItems="Center">
      <Icon size="600" src={Icons.Bell} />
      <Icon size="500" src={Icons.Bell} />
      <Icon size="400" src={Icons.Bell} />
      <Icon size="300" src={Icons.Bell} />
      <Icon size="200" src={Icons.Bell} />
      <Icon size="100" src={Icons.Bell} />
    </Box>
  );
}

export function Filled() {
  return (
    <Box direction="Row" wrap="Wrap" gap="400" alignItems="Center">
      <Icon size="400" src={Icons.Heart} />
      <Icon size="400" src={Icons.Heart} filled />
      <Icon size="400" src={Icons.Star} />
      <Icon size="400" src={Icons.Star} filled />
      <Icon size="400" src={Icons.Bell} />
      <Icon size="400" src={Icons.Bell} filled />
      <Icon size="400" src={Icons.Pin} />
      <Icon size="400" src={Icons.Pin} filled />
    </Box>
  );
}
