import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { EventType } from '$types/matrix-sdk';
import { useSelectedRoom } from '$hooks/router/useSelectedRoom';
import { IsDirectRoomProvider, RoomProvider } from '$hooks/useRoom';
import { useMatrixClient } from '$hooks/useMatrixClient';
import { JoinBeforeNavigate } from '$features/join-before-navigate';
import { buildNotificationBreadcrumb } from '$utils/notificationTelemetry';
import { getAccountData, getMDirects } from '$utils/room';
import { useDirectRooms } from './useDirectRooms';

export function DirectRouteRoomProvider({ children }: { children: ReactNode }) {
  const mx = useMatrixClient();
  const rooms = useDirectRooms();

  const { roomIdOrAlias: encodedRoomIdOrAlias, eventId: encodedEventId } = useParams();
  const roomIdOrAlias = encodedRoomIdOrAlias && decodeURIComponent(encodedRoomIdOrAlias);
  const eventId = encodedEventId && decodeURIComponent(encodedEventId);
  const roomId = useSelectedRoom();
  const room = mx.getRoom(roomId);
  const isJoinedRoom = room?.getMyMembership() === 'join';
  const isKnownDirectRoom = !!room && rooms.includes(room.roomId);
  const liveDirectEvent = getAccountData(mx, EventType.Direct);
  const liveDirects = liveDirectEvent ? getMDirects(liveDirectEvent) : undefined;
  const isLiveDirectRoom = !!room && liveDirects?.has(room.roomId);
  const isDirectClassificationPending = !!room && isJoinedRoom && !isKnownDirectRoom && !liveDirects;

  if (!room) {
    return <JoinBeforeNavigate roomIdOrAlias={roomIdOrAlias!} eventId={eventId} />;
  }

  if (isDirectClassificationPending) {
    return null;
  }

  if (!isKnownDirectRoom && !isLiveDirectRoom && isJoinedRoom) {
    Sentry.addBreadcrumb(
      buildNotificationBreadcrumb('restore', 'restore_direct_route_fallback_render', {
        room_id: room.roomId,
        room_id_or_alias: roomIdOrAlias,
        has_event_id: !!eventId,
      })
    );
  }

  if ((!isKnownDirectRoom && !isLiveDirectRoom) || !isJoinedRoom) {
    return <JoinBeforeNavigate roomIdOrAlias={roomIdOrAlias!} eventId={eventId} />;
  }

  return (
    <RoomProvider key={room.roomId} value={room}>
      <IsDirectRoomProvider value>{children}</IsDirectRoomProvider>
    </RoomProvider>
  );
}
