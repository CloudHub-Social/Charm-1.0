import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Room } from '$types/matrix-sdk';
import type { RoomSettingsState } from '$state/roomSettings';

const {
  mockUseRoomSettingsState,
  mockUseCloseRoomSettings,
  mockGetRoom,
  mockRooms,
  mockUseRoomName,
} = vi.hoisted(() => ({
  mockUseRoomSettingsState: vi.fn<() => RoomSettingsState | undefined>(),
  mockUseCloseRoomSettings: vi.fn<() => () => void>(() => vi.fn<() => void>()),
  mockGetRoom: vi.fn<(roomId: string) => Room | undefined>(),
  mockRooms: new Map<string, Room>(),
  mockUseRoomName: vi.fn<(room: Room) => string>(),
}));

vi.mock('$state/hooks/roomSettings', () => ({
  useRoomSettingsState: mockUseRoomSettingsState,
  useCloseRoomSettings: mockUseCloseRoomSettings,
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

// `useRoomName` (also used by the visible `RoomSettings.tsx` header) is
// DM-nickname- and SDK-recalculation-aware, so it can resolve to a name
// that differs from the room's raw `.name` property (e.g. "Empty room"
// before recalculation, or a DM nickname). Mocking it to return a value
// distinct from `room.name` lets this test prove the dialog label is
// actually sourced from `useRoomName`'s result, not from `room.name`
// directly - which is exactly the regression Finding 4 flagged.
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

vi.mock('./RoomSettings', () => ({
  RoomSettings: () => <div>Room settings body</div>,
}));

function makeRoom(overrides: { roomId: string; name: string }): Room {
  return {
    roomId: overrides.roomId,
    name: overrides.name,
    guessDMUserId: () => null,
  } as unknown as Room;
}

describe('RoomSettingsRenderer', () => {
  it('renders nothing when there is no open state', async () => {
    const { RoomSettingsRenderer } = await import('./RoomSettingsRenderer');
    mockUseRoomSettingsState.mockReturnValue(undefined);

    const { container } = render(<RoomSettingsRenderer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the room cannot be resolved', async () => {
    const { RoomSettingsRenderer } = await import('./RoomSettingsRenderer');
    mockGetRoom.mockImplementation(() => undefined);
    mockUseRoomSettingsState.mockReturnValue({
      roomId: '!missing:example.com',
      spaceId: undefined,
    });

    const { container } = render(<RoomSettingsRenderer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the dialog with useRoomName's resolved name, matching the visible header instead of raw room.name", async () => {
    const { RoomSettingsRenderer } = await import('./RoomSettingsRenderer');
    // `room.name` is deliberately stale/wrong here (as SDK-unrecalculated
    // "Empty room" or a pre-nickname name would be) so a passing assertion
    // on "Design Team Sync" only holds if the renderer goes through
    // `useRoomName` for its label, exactly like `RoomSettings.tsx` does for
    // the visible header.
    const room = makeRoom({ roomId: '!room:example.com', name: 'Empty room' });
    mockRooms.set(room.roomId, room);
    mockGetRoom.mockImplementation((id: string) => mockRooms.get(id));
    mockUseRoomSettingsState.mockReturnValue({ roomId: room.roomId, spaceId: undefined });
    mockUseRoomName.mockReturnValue('Design Team Sync');

    render(<RoomSettingsRenderer />);

    const dialog = await screen.findByRole('dialog', { name: 'Design Team Sync Settings' });
    expect(dialog).toBeInTheDocument();
    expect(mockUseRoomName).toHaveBeenCalledWith(room);
  });
});
