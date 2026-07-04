import { TooltipProvider, Tooltip, Button, IconButton, Icon, Icons, Box, Text } from 'folds';

// TooltipProvider wraps a trigger and shows `tooltip` on hover/focus. A static
// capture shows the triggers (the tooltip bubble itself is showcased by the
// Tooltip component). This card demonstrates the trigger-wrapping API.
export function Triggers() {
  return (
    <Box gap="400" alignItems="Center" style={{ padding: 12 }}>
      <TooltipProvider
        position="Top"
        align="Center"
        tooltip={<Tooltip variant="Surface"><Text as="span" size="T200">Send message</Text></Tooltip>}
      >
        {(triggerRef) => (
          <IconButton ref={triggerRef} variant="Primary" radii="300">
            <Icon size="300" src={Icons.Send} />
          </IconButton>
        )}
      </TooltipProvider>

      <TooltipProvider
        position="Top"
        align="Center"
        tooltip={<Tooltip variant="Surface"><Text as="span" size="T200">Add reaction</Text></Tooltip>}
      >
        {(triggerRef) => (
          <IconButton ref={triggerRef} variant="Secondary" fill="Soft" radii="300">
            <Icon size="300" src={Icons.Smile} />
          </IconButton>
        )}
      </TooltipProvider>

      <TooltipProvider
        position="Bottom"
        align="Center"
        tooltip={<Tooltip variant="Surface"><Text as="span" size="T200">Delete message</Text></Tooltip>}
      >
        {(triggerRef) => (
          <Button ref={triggerRef} variant="Critical" fill="Soft" size="300">
            <Text as="span" size="B300">Delete</Text>
          </Button>
        )}
      </TooltipProvider>
    </Box>
  );
}
