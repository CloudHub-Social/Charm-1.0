import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Room } from '$types/matrix-sdk';
import type { SpaceSettingsState } from '$state/spaceSettings';

const {
  mockUseSpaceSettingsState,
  mockUseCloseSpaceSettings,
  mockGetRoom,
  mockRooms,
  mockUseRoomName,
} = vi.hoisted(() => ({
  mockUseSpaceSettingsState: vi.fn<() => SpaceSettingsState | undefined>(),
  mockUseCloseSpaceSettings: vi.fn<() => () => void>(() => vi.fn<() => void>()),
  mockGetRoom: vi.fn<(roomId: string) => Room | undefined>(),
  mockRooms: new Map<string, Room>(),
  mockUseRoomName: vi.fn<(room: Room) => string>(),
}));

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

// `useRoomName` (also used by the visible `SpaceSettings.tsx` header) is
// SDK-recalculation-aware, so it can resolve to a name that differs from the
// room's raw `.name` property (e.g. "Empty room" before recalculation).
// Mocking it to return a value distinct from `room.name` lets these tests
// prove the dialog label is actually sourced from `useRoomName`'s result,
// not from `room.name` directly.
vi.mock('$hooks/useRoomMeta', () => ({
  useRoomName: mockUseRoomName,
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
    mockUseRoomName.mockReturnValue(topLevelSpace.name);

    render(<SpaceSettingsRenderer />);

    expect(await screen.findByRole('dialog', { name: 'Engineering Settings' })).toBeInTheDocument();
  });

  it(
    "regression: labels the dialog with useRoomName's resolved name, matching the visible " +
      'header (`SpaceSettings.tsx`), instead of raw room.name (comment 3515215011)',
    async () => {
      const { SpaceSettingsRenderer } = await import('./SpaceSettingsRenderer');
      // `room.name` is deliberately stale/wrong here (as SDK-unrecalculated
      // "Empty room" would read) so a passing assertion on "Design Team
      // Sync" only holds if the renderer goes through `useRoomName` for its
      // label, exactly like `SpaceSettings.tsx` does for the visible header.
      const room = makeRoom({ roomId: '!room:example.com', name: 'Empty room' });
      mockRooms.set(room.roomId, room);
      mockGetRoom.mockImplementation((id: string) => mockRooms.get(id));
      mockUseSpaceSettingsState.mockReturnValue({ roomId: room.roomId, spaceId: undefined });
      mockUseRoomName.mockReturnValue('Design Team Sync');

      render(<SpaceSettingsRenderer />);

      const dialog = await screen.findByRole('dialog', { name: 'Design Team Sync Settings' });
      expect(dialog).toBeInTheDocument();
      expect(mockUseRoomName).toHaveBeenCalledWith(room);
    }
  );

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
      mockUseRoomName.mockImplementation((room: Room) => room.name ?? '');

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
