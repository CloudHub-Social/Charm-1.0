import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmojiBoardTab } from '$components/emoji-board/types';
import { EmojiBoardTabs } from './Tabs';

const BOARD_ID = 'board-1';

describe('EmojiBoardTabs', () => {
  it('renders one tab per EmojiBoardTab (including GIFs by default)', () => {
    render(
      <EmojiBoardTabs
        tab={EmojiBoardTab.Emoji}
        onTabChange={vi.fn<(tab: EmojiBoardTab) => void>()}
        boardId={BOARD_ID}
      />
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('omits the GIFs tab when showGifTab is false', () => {
    render(
      <EmojiBoardTabs
        tab={EmojiBoardTab.Emoji}
        onTabChange={vi.fn<(tab: EmojiBoardTab) => void>()}
        boardId={BOARD_ID}
        showGifTab={false}
      />
    );
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('uses a roving tabindex: only the selected tab is in the page tab order', () => {
    render(
      <EmojiBoardTabs
        tab={EmojiBoardTab.Sticker}
        onTabChange={vi.fn<(tab: EmojiBoardTab) => void>()}
        boardId={BOARD_ID}
      />
    );
    const emojiTab = screen.getByRole('tab', { name: 'Emoji' });
    const stickerTab = screen.getByRole('tab', { name: 'Stickers' });
    const gifTab = screen.getByRole('tab', { name: 'GIFs' });

    expect(stickerTab).toHaveAttribute('aria-selected', 'true');
    expect(stickerTab).toHaveAttribute('tabindex', '0');
    expect(emojiTab).toHaveAttribute('aria-selected', 'false');
    expect(emojiTab).toHaveAttribute('tabindex', '-1');
    expect(gifTab).toHaveAttribute('aria-selected', 'false');
    expect(gifTab).toHaveAttribute('tabindex', '-1');
  });

  it('only the selected tab carries aria-controls, targeting its own panel id -- inactive tabs omit it rather than referencing a panel that is not mounted', () => {
    render(
      <EmojiBoardTabs
        tab={EmojiBoardTab.Emoji}
        onTabChange={vi.fn<(tab: EmojiBoardTab) => void>()}
        boardId={BOARD_ID}
      />
    );
    const emojiTab = screen.getByRole('tab', { name: 'Emoji' });
    const stickerTab = screen.getByRole('tab', { name: 'Stickers' });

    const emojiControls = emojiTab.getAttribute('aria-controls');
    const stickerControls = stickerTab.getAttribute('aria-controls');

    expect(emojiControls).toBe(`${BOARD_ID}-EmojiBoardTabPanel-${EmojiBoardTab.Emoji}`);
    expect(stickerControls).toBeNull();
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn<(tab: EmojiBoardTab) => void>();
    render(
      <EmojiBoardTabs tab={EmojiBoardTab.Emoji} onTabChange={onTabChange} boardId={BOARD_ID} />
    );

    await user.click(screen.getByRole('tab', { name: 'Stickers' }));
    expect(onTabChange).toHaveBeenCalledWith(EmojiBoardTab.Sticker);
  });

  it('moves focus and selection to the next tab on ArrowRight', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn<(tab: EmojiBoardTab) => void>();
    render(
      <EmojiBoardTabs tab={EmojiBoardTab.Emoji} onTabChange={onTabChange} boardId={BOARD_ID} />
    );

    screen.getByRole('tab', { name: 'Emoji' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onTabChange).toHaveBeenCalledWith(EmojiBoardTab.Sticker);
    expect(screen.getByRole('tab', { name: 'Stickers' })).toHaveFocus();
  });

  it('wraps from the first to the last tab on ArrowLeft', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn<(tab: EmojiBoardTab) => void>();
    render(
      <EmojiBoardTabs tab={EmojiBoardTab.Emoji} onTabChange={onTabChange} boardId={BOARD_ID} />
    );

    screen.getByRole('tab', { name: 'Emoji' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(onTabChange).toHaveBeenCalledWith(EmojiBoardTab.Gif);
    expect(screen.getByRole('tab', { name: 'GIFs' })).toHaveFocus();
  });
});
