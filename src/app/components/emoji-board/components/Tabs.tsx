import type { CSSProperties } from 'react';
import { Badge, Box, Text, color, config } from 'folds';
import { EmojiBoardTab } from '$components/emoji-board/types';

const styles: CSSProperties = {
  cursor: 'pointer',
};

export function EmojiBoardTabs({
  tab,
  onTabChange,
  showGifTab = true,
}: {
  tab: EmojiBoardTab;
  onTabChange: (tab: EmojiBoardTab) => void;
  showGifTab?: boolean;
}) {
  const tabs = [
    {
      id: EmojiBoardTab.Emoji,
      label: 'Emoji',
    },
    ...(showGifTab
      ? [
          {
            id: EmojiBoardTab.Gif,
            label: 'GIFs',
          },
        ]
      : []),
    {
      id: EmojiBoardTab.Sticker,
      label: 'Stickers',
    },
  ] as const;

  return (
    <Box
      gap="100"
      style={{
        padding: config.space.S100,
        borderRadius: config.radii.R400,
        backgroundColor: color.SurfaceVariant.Container,
        width: '100%',
      }}
    >
      {tabs.map((item) => (
        <Badge
          key={item.id}
          style={{ ...styles, flex: 1, justifyContent: 'center' }}
          as="button"
          variant={tab === item.id ? 'Primary' : 'Secondary'}
          fill={tab === item.id ? 'Solid' : 'None'}
          size="500"
          onClick={() => onTabChange(item.id)}
        >
          <Text as="span" size="L400">
            {item.label}
          </Text>
        </Badge>
      ))}
    </Box>
  );
}
