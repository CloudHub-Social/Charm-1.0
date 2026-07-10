import { TextArea, Box } from 'folds';

export function MessageDraft() {
  return (
    <Box direction="Column" gap="300" style={{ width: 320 }}>
      <TextArea
        variant="Surface"
        outlined
        rows={4}
        resize="Vertical"
        defaultValue={"Hey team — pushed the fix for the composer redesign.\nCan someone review PR #549 before standup?\nThanks!"}
      />
    </Box>
  );
}

export function Placeholder() {
  return (
    <Box direction="Column" gap="300" style={{ width: 320 }}>
      <TextArea
        variant="Surface"
        outlined
        rows={4}
        resize="Vertical"
        placeholder="Write a message…"
      />
    </Box>
  );
}

export function Variants() {
  return (
    <Box direction="Column" gap="300" style={{ width: 320 }}>
      <TextArea variant="Surface" outlined rows={2} defaultValue="Surface" />
      <TextArea variant="SurfaceVariant" outlined rows={2} defaultValue="Surface variant" />
      <TextArea variant="Critical" outlined rows={2} defaultValue="Message failed to send" />
    </Box>
  );
}

export function Disabled() {
  return (
    <Box direction="Column" gap="300" style={{ width: 320 }}>
      <TextArea
        variant="Surface"
        outlined
        rows={3}
        disabled
        defaultValue="You do not have permission to send messages in this room."
      />
    </Box>
  );
}
