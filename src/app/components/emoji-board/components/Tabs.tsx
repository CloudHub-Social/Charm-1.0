import type { CSSProperties, KeyboardEvent } from 'react';
import { useRef } from 'react';
import { Badge, Box, Text, color, config } from 'folds';
import { EmojiBoardTab } from '$components/emoji-board/types';

const styles: CSSProperties = {
  cursor: 'pointer',
};

export function EmojiBoardTabs({
  tab,
  onTabChange,
  onKeyboardTabChange,
  showGifTab = true,
  boardId,
}: {
  tab: EmojiBoardTab;
  onTabChange: (tab: EmojiBoardTab) => void;
  /**
   * Called instead of onTabChange when a tab is selected via keyboard
   * (Arrow/Home/End) navigation rather than a click. Falls back to
   * onTabChange when not provided. Lets callers distinguish keyboard-driven
   * selection so they can, e.g., avoid stealing focus away from the tablist
   * (see EmojiBoard's search-input autoFocus suppression).
   */
  onKeyboardTabChange?: (tab: EmojiBoardTab) => void;
  showGifTab?: boolean;
  /** Unique id for this EmojiBoard instance, so tab/panel ids never collide across multiple boards mounted at once. */
  boardId: string;
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

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAndSelectTab = (index: number) => {
    const wrapped = (index + tabs.length) % tabs.length;
    const target = tabs[wrapped];
    if (!target) return;
    tabRefs.current[wrapped]?.focus();
    (onKeyboardTabChange ?? onTabChange)(target.id);
  };

  const handleKeyDown = (evt: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (evt.key === 'ArrowRight') {
      evt.preventDefault();
      focusAndSelectTab(index + 1);
    } else if (evt.key === 'ArrowLeft') {
      evt.preventDefault();
      focusAndSelectTab(index - 1);
    } else if (evt.key === 'Home') {
      evt.preventDefault();
      focusAndSelectTab(0);
    } else if (evt.key === 'End') {
      evt.preventDefault();
      focusAndSelectTab(tabs.length - 1);
    }
  };

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
      {tabs.map((item, index) => {
        const selected = tab === item.id;
        return (
          <Badge
            key={item.id}
            ref={(el: HTMLButtonElement | null) => {
              tabRefs.current[index] = el;
            }}
            id={`${boardId}-EmojiBoardTab-${item.id}`}
            style={{ ...styles, flex: 1, justifyContent: 'center' }}
            as="button"
            type="button"
            role="tab"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-controls={selected ? `${boardId}-EmojiBoardTabPanel-${item.id}` : undefined}
            variant={selected ? 'Primary' : 'Secondary'}
            fill={selected ? 'Solid' : 'None'}
            size="500"
            onClick={() => onTabChange(item.id)}
            onKeyDown={(evt) => handleKeyDown(evt, index)}
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
