import { Avatar, AvatarFallback, Box, Text, Icon, Icons } from 'folds';

export function Initials() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Text size="H4">EG</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#0ea5e9', color: 'white' }}>
          <Text size="H4">AB</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#30a46c', color: 'white' }}>
          <Text size="H4">GH</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#e5484d', color: 'white' }}>
          <Text size="H4">LT</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#f76808', color: 'white' }}>
          <Text size="H4">MM</Text>
        </AvatarFallback>
      </Avatar>
    </Box>
  );
}

export function WithIcons() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Icon size="400" src={Icons.Hash} />
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#0ea5e9', color: 'white' }}>
          <Icon size="400" src={Icons.Space} />
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#30a46c', color: 'white' }}>
          <Icon size="400" src={Icons.User} />
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#e5484d', color: 'white' }}>
          <Icon size="400" src={Icons.Message} />
        </AvatarFallback>
      </Avatar>
    </Box>
  );
}

export function Sizes() {
  return (
    <Box direction="Row" wrap="Wrap" gap="300" alignItems="Center">
      <Avatar size="500">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Text size="H3">EG</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="400">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Text size="H4">EG</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="300">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Text size="H5">EG</Text>
        </AvatarFallback>
      </Avatar>
      <Avatar size="200">
        <AvatarFallback style={{ backgroundColor: '#6e56cf', color: 'white' }}>
          <Text size="H6">EG</Text>
        </AvatarFallback>
      </Avatar>
    </Box>
  );
}
