import { atom, useSetAtom } from 'jotai';
import type { MatrixClient, MatrixEvent } from '$types/matrix-sdk';
import { ClientEvent, EventType } from '$types/matrix-sdk';
import { useEffect } from 'react';

import { getAccountData, getMDirects } from '$utils/room';

export type MDirectAction = {
  type: 'INITIALIZE' | 'UPDATE';
  rooms: Set<string>;
};

const baseMDirectAtom = atom(new Set<string>());
export const mDirectAtom = atom<Set<string>, [MDirectAction], undefined>(
  (get) => get(baseMDirectAtom),
  (get, set, action) => {
    set(baseMDirectAtom, action.rooms);
  }
);

// True once useBindMDirectAtom's effect has run at least once for the active client, so
// consumers that need to know "is this room a DM" *correctly* (not just with whatever
// mDirectAtom's initial empty-Set default happens to be) have a readiness signal to wait
// on. ClientBindAtoms — which calls useBindMDirectAtom — is the parent of both
// NotificationJumper and the routed ToRoomEvent, so on a cold launch their effects run
// before this one: reading mDirectAtom.has(roomId) there before this atom is true can
// read false for a genuine DM, misclassifying an incoming call notification. Plain
// writable atom (not a derived read-only view) so tests can seed it directly.
export const mDirectReadyAtom = atom(false);

export const useBindMDirectAtom = (mx: MatrixClient, mDirect: typeof mDirectAtom) => {
  const setMDirect = useSetAtom(mDirect);
  const setMDirectReady = useSetAtom(mDirectReadyAtom);

  useEffect(() => {
    const mDirectEvent = getAccountData(mx, EventType.Direct);
    if (mDirectEvent) {
      setMDirect({
        type: 'INITIALIZE',
        rooms: getMDirects(mDirectEvent),
      });
    }
    setMDirectReady(true);

    const handleAccountData = (event: MatrixEvent) => {
      if (event.getType() === (EventType.Direct as string)) {
        setMDirect({
          type: 'UPDATE',
          rooms: getMDirects(event),
        });
      }
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
      setMDirectReady(false);
    };
  }, [mx, setMDirect, setMDirectReady]);
};
