import { Avatar, AvatarImage, AvatarFallback, Box, Text } from 'folds';

// Inline SVG data-URIs so the cell renders even without network access.
const gradientAvatar = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/></svg>`
  )}`;

export function People() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <Avatar size="400">
        <AvatarImage src={gradientAvatar('#6e56cf', '#0ea5e9')} alt="@ada:charm.im" />
      </Avatar>
      <Avatar size="400">
        <AvatarImage src={gradientAvatar('#12a594', '#30a46c')} alt="@grace:charm.im" />
      </Avatar>
      <Avatar size="400">
        <AvatarImage src={gradientAvatar('#f76808', '#e5484d')} alt="@linus:charm.im" />
      </Avatar>
      <Avatar size="400">
        <AvatarImage src={gradientAvatar('#8e4ec6', '#e93d82')} alt="@margaret:charm.im" />
      </Avatar>
    </Box>
  );
}

export function SizeSweep() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <Avatar size="500">
        <AvatarImage src={gradientAvatar('#6e56cf', '#0ea5e9')} alt="@ada:charm.im" />
      </Avatar>
      <Avatar size="400">
        <AvatarImage src={gradientAvatar('#6e56cf', '#0ea5e9')} alt="@ada:charm.im" />
      </Avatar>
      <Avatar size="300">
        <AvatarImage src={gradientAvatar('#6e56cf', '#0ea5e9')} alt="@ada:charm.im" />
      </Avatar>
      <Avatar size="200">
        <AvatarImage src={gradientAvatar('#6e56cf', '#0ea5e9')} alt="@ada:charm.im" />
      </Avatar>
    </Box>
  );
}

export function WithFallback() {
  // AvatarImage falls back to the sibling AvatarFallback if the image fails to load.
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <Avatar size="400">
        <AvatarImage src={gradientAvatar('#6e56cf', '#8e4ec6')} alt="Design Team" />
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Text size="H4">DT</Text>
        </AvatarFallback>
      </Avatar>
    </Box>
  );
}
