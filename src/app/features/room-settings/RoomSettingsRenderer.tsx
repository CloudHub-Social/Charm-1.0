import type { Room } from '$types/matrix-sdk';
import { Modal500 } from '$components/Modal500';
import { useCloseRoomSettings, useRoomSettingsState } from '$state/hooks/roomSettings';
import { useAllJoinedRoomsSet, useGetRoom } from '$hooks/useGetRoom';
import type { RoomSettingsState } from '$state/roomSettings';
import { RoomProvider } from '$hooks/useRoom';
import { SpaceProvider } from '$hooks/useSpace';
import { useRoomName } from '$hooks/useRoomMeta';
import { RoomSettings } from './RoomSettings';

type RenderSettingsDialogProps = {
  room: Room;
  space: Room | undefined;
  page: RoomSettingsState['page'];
  closeSettings: () => void;
};
// Split out so `useRoomName(room)` can be called unconditionally on a
// guaranteed non-null `room`, once resolved by `RenderSettings` below.
function RenderSettingsDialog({ room, space, page, closeSettings }: RenderSettingsDialogProps) {
  // Use the same `useRoomName` path as the visible settings header
  // (`RoomSettings.tsx`'s `roomName`) rather than raw `room.name`, which
  // can diverge for DM rooms (nickname tagging) or rooms still awaiting
  // SDK name recalculation (e.g. reads as "Empty room" until
  // `room.recalculate()` runs) - otherwise the dialog's accessible name
  // can differ from what's visually shown.
  const roomName = useRoomName(room) || 'Room';

  return (
    <Modal500 requestClose={closeSettings} fullScreenOnMobile ariaLabel={`${roomName} Settings`}>
      <SpaceProvider value={space ?? null}>
        <RoomProvider value={room}>
          <RoomSettings initialPage={page} requestClose={closeSettings} />
        </RoomProvider>
      </SpaceProvider>
    </Modal500>
  );
}

type RenderSettingsProps = {
  state: RoomSettingsState;
};
function RenderSettings({ state }: RenderSettingsProps) {
  const { roomId, spaceId, page } = state;
  const closeSettings = useCloseRoomSettings();
  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);
  const room = getRoom(roomId);
  const space = spaceId ? getRoom(spaceId) : undefined;

  if (!room) return null;

  return (
    <RenderSettingsDialog room={room} space={space} page={page} closeSettings={closeSettings} />
  );
}

export function RoomSettingsRenderer() {
  const state = useRoomSettingsState();

  if (!state) return null;
  return <RenderSettings state={state} />;
}
