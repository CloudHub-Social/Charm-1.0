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
  boardId,
  panelId,
}: {
  tab: EmojiBoardTab;
  onTabChange: (tab: EmojiBoardTab) => void;
  showGifTab?: boolean;
  /** Unique id for this EmojiBoard instance, so tab/panel ids never collide across multiple boards mounted at once. */
  boardId: string;
  /** id of the tabpanel these tabs control. */
  panelId: string;
}) {
  const tabs = [
    {
      id: EmojiBoardTab.Emoji,
      label: 'Emoji',
    },
    {
      id: EmojiBoardTab.Sticker,
      label: 'Stickers',
    },
    ...(showGifTab
      ? [
          {
            id: EmojiBoardTab.Gif,
            label: 'GIFs',
          },
        ]
      : []),
  ] as const;

  return (
    <Box
      role="tablist"
      gap="100"
      style={{
        padding: config.space.S100,
        borderRadius: config.radii.R400,
        backgroundColor: color.SurfaceVariant.Container,
        width: '100%',
      }}
    >
      {tabs.map((item) => {
        const selected = tab === item.id;
        return (
          <Badge
            key={item.id}
            id={`${boardId}-EmojiBoardTab-${item.id}`}
            style={{ ...styles, flex: 1, justifyContent: 'center' }}
            as="button"
            type="button"
            role="tab"
            tabIndex={0}
            aria-selected={selected}
            aria-controls={panelId}
            variant={selected ? 'Primary' : 'Secondary'}
            fill={selected ? 'Solid' : 'None'}
            size="500"
            onClick={() => onTabChange(item.id)}
          >
            <Text as="span" size="L400">
              {item.label}
            </Text>
          </Badge>
        );
      })}
    </Box>
  );
}
