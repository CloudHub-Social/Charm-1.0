import { Box, Scroll, Text } from 'folds';

const rooms = ['general', 'random', 'design-sync', 'engineering', 'support', 'announcements', 'off-topic', 'releases', 'incidents', 'watercooler'];
const tags = ['react', 'typescript', 'matrix', 'tauri', 'vanilla-extract', 'playwright', 'vite', 'folds', 'design-system'];

function Frame({ children, width = 240 }: { children: React.ReactNode; width?: number }) {
  return (
    <Box style={{ width, border: '1px solid #d4d4d8', borderRadius: 8, overflow: 'hidden' }}>
      {children}
    </Box>
  );
}

// A scrollable channel list: content is taller than the 160px viewport, so the
// last row is clipped — demonstrating vertical overflow within the Scroll region.
export function Vertical() {
  return (
    <Frame>
      <Scroll variant="Surface" size="400" visibility="Always" direction="Vertical" style={{ height: 160 }}>
        <Box direction="Column" gap="100" style={{ padding: 8 }}>
          {rooms.map((r) => (
            <div key={r} style={{ background: '#e5e5e5', padding: 10, borderRadius: 6 }}>
              <Text as="span" size="T300">#{r}</Text>
            </div>
          ))}
        </Box>
      </Scroll>
    </Frame>
  );
}

// Horizontal scroll: a single nowrap row wider than the container, clipped on the
// right edge — demonstrating horizontal overflow.
export function Horizontal() {
  return (
    <Frame>
      <Scroll variant="Surface" size="400" visibility="Always" direction="Horizontal">
        <Box direction="Row" gap="200" wrap="NoWrap" style={{ padding: 12, width: 'max-content' }}>
          {tags.map((t) => (
            <div key={t} style={{ background: '#dbe4ff', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              <Text as="span" size="T300">#{t}</Text>
            </div>
          ))}
        </Box>
      </Scroll>
    </Frame>
  );
}

// Scroll in both axes: a grid larger than the viewport, clipped on the right and
// bottom.
export function Both() {
  const cells = Array.from({ length: 24 }, (_, i) => i + 1);
  return (
    <Frame>
      <Scroll variant="Surface" size="400" visibility="Always" direction="Both" style={{ height: 160 }}>
        <Box direction="Row" wrap="Wrap" gap="200" style={{ padding: 8, width: 420 }}>
          {cells.map((n) => (
            <div key={n} style={{ background: '#e5e5e5', width: 56, height: 40, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text as="span" size="T300">{n}</Text>
            </div>
          ))}
        </Box>
      </Scroll>
    </Frame>
  );
}

// A realistic reading pane: long body text clipped at the bottom of a fixed-height
// Scroll region.
export function TextPane() {
  return (
    <Frame width={280}>
      <Scroll variant="Surface" size="400" visibility="Always" direction="Vertical" style={{ height: 160 }}>
        <Box direction="Column" gap="200" style={{ padding: 12 }}>
          <Text size="H6">Release notes</Text>
          <Text size="T300">Folds 2.6.2 ships refined layout primitives and accessibility fixes across the component set.</Text>
          <Text size="T300">The Scroll container now supports vertical, horizontal, and both-axis overflow with configurable track visibility.</Text>
          <Text size="T300">Header gained size tokens from 300 to 700, and Line variants map onto the semantic color palette.</Text>
          <Text size="T300">See the migration guide for details on the updated Box flex API.</Text>
        </Box>
      </Scroll>
    </Frame>
  );
}
