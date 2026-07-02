import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EmojiBoardTab } from '$components/emoji-board/types';
import { EmojiBoardTabs } from './Tabs';
import { SearchInput } from './SearchInput';

const BOARD_ID = 'board-focus-1';

/**
 * Mirrors EmojiBoard.tsx's actual wiring: activeTab state owned by the
 * parent, EmojiBoardTabs + a SearchInput keyed by activeTab (so it remounts
 * on every tab change), and a ref that's set synchronously by
 * onTabChange/onKeyboardTabChange before the state update that triggers the
 * remount -- this is the exact shape of the arrow-key/autofocus regression.
 */
function TabsWithSearch() {
  const [activeTab, setActiveTab] = useState<EmojiBoardTab>(EmojiBoardTab.Emoji);
  const suppressSearchAutoFocusRef = useRef(false);

  return (
    <>
      <EmojiBoardTabs
        tab={activeTab}
        onTabChange={(t) => {
          suppressSearchAutoFocusRef.current = false;
          setActiveTab(t);
        }}
        onKeyboardTabChange={(t) => {
          suppressSearchAutoFocusRef.current = true;
          setActiveTab(t);
        }}
        boardId={BOARD_ID}
      />
      <SearchInput
        key={activeTab}
        tab={activeTab}
        onChange={() => {}}
        suppressAutoFocus={suppressSearchAutoFocusRef.current}
      />
    </>
  );
}

describe('EmojiBoardTabs + SearchInput autofocus interaction', () => {
  it('keeps focus on the tab after ArrowRight, even though the remounted SearchInput would otherwise autofocus', async () => {
    const user = userEvent.setup();
    render(<TabsWithSearch />);

    screen.getByRole('tab', { name: 'Emoji' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Stickers' })).toHaveFocus();
  });

  it('still autofocuses the search input on a plain tab click (unlike keyboard navigation)', async () => {
    const user = userEvent.setup();
    render(<TabsWithSearch />);

    await user.click(screen.getByRole('tab', { name: 'Stickers' }));

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveFocus();
  });
});
