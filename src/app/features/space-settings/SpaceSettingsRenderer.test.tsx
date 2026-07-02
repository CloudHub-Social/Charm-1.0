import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Room } from '$types/matrix-sdk';
import type { SpaceSettingsState } from '$state/spaceSettings';

const { mockUseSpaceSettingsState, mockUseCloseSpaceSettings, mockGetRoom, mockRooms } = vi.hoisted(
  () => ({
    mockUseSpaceSettingsState: vi.fn<() => SpaceSettingsState | undefined>(),
    mockUseCloseSpaceSettings: vi.fn<() => () => void>(() => vi.fn<() => void>()),
    mockGetRoom: vi.fn<(roomId: string) => Room | undefined>(),
    mockRooms: new Map<string, Room>(),
  })
);

vi.mock('$state/hooks/spaceSettings', () => ({
  useSpaceSettingsState: mockUseSpaceSettingsState,
  useCloseSpaceSettings: mockUseCloseSpaceSettings,
}));

vi.mock('$hooks/useGetRoom', () => ({
  useAllJoinedRoomsSet: () => new Set(mockRooms.keys()),
  useGetRoom: () => mockGetRoom,
}));

vi.mock('$hooks/useRoom', () => ({
  RoomProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('$hooks/useSpace', () => ({
  SpaceProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('$components/Modal500', () => ({
  Modal500: ({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) => (
    <div role="dialog" aria-label={ariaLabel}>
      {children}
    </div>
  ),
}));

vi.mock('./SpaceSettings', () => ({
  SpaceSettings: () => <div>Space settings body</div>,
}));

function makeRoom(overrides: { roomId: string; name: string }): Room {
  return { roomId: overrides.roomId, name: overrides.name } as unknown as Room;
}

describe('SpaceSettingsRenderer', () => {
  it('renders nothing when there is no open state', async () => {
    const { SpaceSettingsRenderer } = await import('./SpaceSettingsRenderer');
    mockUseSpaceSettingsState.mockReturnValue(undefined);

    const { container } = render(<SpaceSettingsRenderer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the target room cannot be resolved', async () => {
    const { SpaceSettingsRenderer } = await import('./SpaceSettingsRenderer');
    mockGetRoom.mockImplementation(() => undefined);
    mockUseSpaceSettingsState.mockReturnValue({
      roomId: '!missing:example.com',
      spaceId: undefined,
    });

    const { container } = render(<SpaceSettingsRenderer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels a top-level space settings dialog with that space name (no parent context)', async () => {
    const { SpaceSettingsRenderer } = await import('./SpaceSettingsRenderer');
    const topLevelSpace = makeRoom({ roomId: '!top:example.com', name: 'Engineering' });
    mockRooms.set(topLevelSpace.roomId, topLevelSpace);
    mockGetRoom.mockImplementation((id: string) => mockRooms.get(id));
    mockUseSpaceSettingsState.mockReturnValue({ roomId: topLevelSpace.roomId, spaceId: undefined });

    render(<SpaceSettingsRenderer />);

    expect(await screen.findByRole('dialog', { name: 'Engineering Settings' })).toBeInTheDocument();
  });

  it(
    'regression: labels a nested space settings dialog with the CHILD space being edited, ' +
      'not the parent space passed as breadcrumb context (Finding 3 / comment 3515009732)',
    async () => {
      const { SpaceSettingsRenderer } = await import('./SpaceSettingsRenderer');
      // Mirrors `HierarchyItemMenu`'s `openSpaceSettings(item.roomId, item.parentId)`:
      // `roomId` (-> `room`) is the space actually rendered inside
      // `RoomProvider` and edited by `SpaceSettings`; `spaceId` (-> `space`)
      // is only the parent context. Before the fix, the label used
      // `(space ?? room).name`, which announced "Design (Parent Space)
      // Settings" here even though the dialog edits "Roadmap (Child
      // Space)".
      const parentSpace = makeRoom({
        roomId: '!parent:example.com',
        name: 'Design (Parent Space)',
      });
      const childSpace = makeRoom({ roomId: '!child:example.com', name: 'Roadmap (Child Space)' });
      mockRooms.set(parentSpace.roomId, parentSpace);
      mockRooms.set(childSpace.roomId, childSpace);
      mockGetRoom.mockImplementation((id: string) => mockRooms.get(id));
      mockUseSpaceSettingsState.mockReturnValue({
        roomId: childSpace.roomId,
        spaceId: parentSpace.roomId,
      });

      render(<SpaceSettingsRenderer />);

      expect(
        await screen.findByRole('dialog', { name: 'Roadmap (Child Space) Settings' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('dialog', { name: 'Design (Parent Space) Settings' })
      ).not.toBeInTheDocument();
    }
  );
});
