import type { MatrixClient } from 'matrix-js-sdk';
import { SetPresence } from 'matrix-js-sdk';
import { Presence } from '../hooks/useUserPresence';

const PRESENCE_TO_SET_PRESENCE: Record<Presence, SetPresence> = {
  [Presence.Online]: SetPresence.Online,
  [Presence.Unavailable]: SetPresence.Unavailable,
  [Presence.Offline]: SetPresence.Offline,
  // Dnd is a local display-only enum value (signalled via [dnd] status message);
  // Matrix has no native dnd presence so we map it to unavailable.
  [Presence.Dnd]: SetPresence.Unavailable,
};

export const presenceToSetPresence = (presence: Presence): SetPresence =>
  PRESENCE_TO_SET_PRESENCE[presence];

export const setUserPresence = async (
  mx: MatrixClient,
  presence: Presence,
  statusMsg?: string
): Promise<void> => {
  await Promise.all([
    mx.setSyncPresence(presenceToSetPresence(presence)),
    mx.setPresence({
      presence: presenceToSetPresence(presence),
      status_msg: statusMsg,
    }),
  ]);
};
