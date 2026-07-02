import { Modal500 } from '$components/Modal500';
import { useCloseSpaceSettings, useSpaceSettingsState } from '$state/hooks/spaceSettings';
import { useAllJoinedRoomsSet, useGetRoom } from '$hooks/useGetRoom';
import type { SpaceSettingsState } from '$state/spaceSettings';
import { RoomProvider } from '$hooks/useRoom';
import { SpaceProvider } from '$hooks/useSpace';
import { SpaceSettings } from './SpaceSettings';

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

  // `room` is the space actually being edited below (see `RoomProvider`);
  // `space`, when present, is only the *parent* space context passed for
  // breadcrumb/provider purposes (see `useOpenSpaceSettings` callers, e.g.
  // `HierarchyItemMenu`'s `openSpaceSettings(item.roomId, item.parentId)`).
  // Labeling with `space ?? room` would announce the parent's name for
  // nested spaces even though the dialog edits the child (`room`).
  const settingsSubjectName = room.name || 'Space';

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

export function SpaceSettingsRenderer() {
  const state = useSpaceSettingsState();

  if (!state) return null;
  return <RenderSettings state={state} />;
}
