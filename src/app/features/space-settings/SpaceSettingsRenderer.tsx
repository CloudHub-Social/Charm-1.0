import type { Room } from '$types/matrix-sdk';
import { Modal500 } from '$components/Modal500';
import { useCloseSpaceSettings, useSpaceSettingsState } from '$state/hooks/spaceSettings';
import { useAllJoinedRoomsSet, useGetRoom } from '$hooks/useGetRoom';
import type { SpaceSettingsState } from '$state/spaceSettings';
import { RoomProvider } from '$hooks/useRoom';
import { SpaceProvider } from '$hooks/useSpace';
import { useRoomName } from '$hooks/useRoomMeta';
import { SpaceSettings } from './SpaceSettings';

type RenderSettingsDialogProps = {
  room: Room;
  space: Room | undefined;
  page: SpaceSettingsState['page'];
  closeSettings: () => void;
};
// Split out so `useRoomName(room)` can be called unconditionally on a
// guaranteed non-null `room`, once resolved by `RenderSettings` below.
function RenderSettingsDialog({ room, space, page, closeSettings }: RenderSettingsDialogProps) {
  // Use the same `useRoomName` path as the visible settings header
  // (`SpaceSettings.tsx`'s `roomName`) rather than raw `room.name`, which
  // can read as "Empty room" until SDK name recalculation runs - otherwise
  // the dialog's accessible name can differ from what's visually shown.
  //
  // `room` (not `space ?? room`) is the space actually being edited below
  // (see `RoomProvider`); `space`, when present, is only the *parent* space
  // context passed for breadcrumb/provider purposes (see
  // `useOpenSpaceSettings` callers, e.g. `HierarchyItemMenu`'s
  // `openSpaceSettings(item.roomId, item.parentId)`). Labeling with
  // `space ?? room` would announce the parent's name for nested spaces even
  // though the dialog edits the child (`room`).
  const settingsSubjectName = useRoomName(room) || 'Space';

  return (
    <Modal500
      requestClose={closeSettings}
      fullScreenOnMobile
      ariaLabel={`${settingsSubjectName} Settings`}
    >
      <SpaceProvider value={space ?? null}>
        <RoomProvider value={room}>
          <SpaceSettings initialPage={page} requestClose={closeSettings} />
        </RoomProvider>
      </SpaceProvider>
    </Modal500>
  );
}

type RenderSettingsProps = {
  state: SpaceSettingsState;
};
function RenderSettings({ state }: RenderSettingsProps) {
  const { roomId, spaceId, page } = state;
  const closeSettings = useCloseSpaceSettings();
  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);
  const room = getRoom(roomId);
  const space = spaceId && spaceId !== roomId ? getRoom(spaceId) : undefined;

  if (!room) return null;

  return (
    <RenderSettingsDialog room={room} space={space} page={page} closeSettings={closeSettings} />
  );
}

export function SpaceSettingsRenderer() {
  const state = useSpaceSettingsState();

  if (!state) return null;
  return <RenderSettings state={state} />;
}
