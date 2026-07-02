import { render, waitFor } from '@testing-library/react';
import { createStore, Provider, useAtomValue } from 'jotai';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { activeSessionIdAtom, pendingNotificationAtom } from '$state/sessions';
import { incomingCallAtom } from '$state/callEmbed';
import { mDirectAtom } from '$state/mDirectList';
import { ToRoomEvent } from './ToRoomEvent';

function AtomProbe() {
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const pendingNotification = useAtomValue(pendingNotificationAtom);
  const incomingCall = useAtomValue(incomingCallAtom);

  return (
    <pre data-testid="probe">
      {JSON.stringify({
        activeSessionId,
        pendingNotification,
        incomingCall,
      })}
    </pre>
  );
}


describe('ToRoomEvent', () => {
  it('captures join-call notification restore state from the route and query string', async () => {
    const { getByTestId } = render(
      <Provider>
        <MemoryRouter
          initialEntries={[
            '/to/%40alice%3Aexample/!room%3Aexample/%24event123?joinCall=true&swClickId=notification-click-123&jumpMode=notification_live',
          ]}
        >
          {/* AtomProbe lives outside <Routes> — ToRoomEvent navigates away to "/" once its
              effect runs, so a probe scoped to the /to/... route would unmount before this
              test can read the atoms it set. The "/" route below is only there so that
              navigation resolves to a real match instead of an unmatched-route warning. */}
          <Routes>
            <Route path="/to/:user_id/:room_id/:event_id?" element={<ToRoomEvent />} />
            <Route path="/" element={<div />} />
          </Routes>
          <AtomProbe />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      const payload = JSON.parse(getByTestId('probe').textContent ?? '{}') as {
        activeSessionId?: string;
        pendingNotification?: {
          roomId?: string;
          eventId?: string;
          jumpMode?: string;
          joinCall?: boolean;
          targetSessionId?: string;
          requestedAt?: number;
          source?: string;
          swClickId?: string;
          callSearchParams?: string;
        };
        incomingCall?: unknown;
      };

      expect(payload.activeSessionId).toBe('@alice:example');
      expect(payload.pendingNotification?.roomId).toBe('!room:example');
      expect(payload.pendingNotification?.eventId).toBe('$event123');
      expect(payload.pendingNotification?.jumpMode).toBe('notification_live');
      expect(payload.pendingNotification?.joinCall).toBe(true);
      expect(payload.pendingNotification?.targetSessionId).toBe('@alice:example');
      expect(payload.pendingNotification?.source).toBe('to_room_event');
      expect(payload.pendingNotification?.swClickId).toBe('notification-click-123');
      expect(typeof payload.pendingNotification?.requestedAt).toBe('number');
      // No session was active before this click (fresh Provider, activeSessionId starts
      // undefined) — this is an account switch, so incoming-call resolution must be
      // deferred rather than resolved eagerly against the not-yet-active session's atoms.
      expect(payload.pendingNotification?.callSearchParams).toContain('joinCall=true');
      expect(payload.incomingCall).toBeNull();
    });
  });

  it('resolves the incoming call immediately when no account switch is needed', async () => {
    // Seed the store before mount (not via an effect) so activeSessionIdAtom already
    // reflects the "already active" account on ToRoomEvent's first render — matching a
    // real pre-existing session, rather than racing ToRoomEvent's own mount-effect.
    const store = createStore();
    store.set(activeSessionIdAtom, '@alice:example');
    // isIncomingCallSuppressed drops non-direct room calls unless a setting is enabled —
    // mark this room as a DM so the resolved call isn't suppressed for an unrelated reason.
    store.set(mDirectAtom, { type: 'INITIALIZE', rooms: new Set(['!room:example']) });

    const { getByTestId } = render(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[
            '/to/%40alice%3Aexample/!room%3Aexample/%24event123?joinCall=true&jumpMode=notification_live',
          ]}
        >
          <Routes>
            <Route path="/to/:user_id/:room_id/:event_id?" element={<ToRoomEvent />} />
            <Route path="/" element={<div />} />
          </Routes>
          <AtomProbe />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      const payload = JSON.parse(getByTestId('probe').textContent ?? '{}') as {
        pendingNotification?: { callSearchParams?: string };
        incomingCall?: { roomId?: string } | null;
      };

      expect(payload.incomingCall?.roomId).toBe('!room:example');
      expect(payload.pendingNotification?.callSearchParams).toBeUndefined();
    });
  });

  it('defaults non-notification deep links to history_context', async () => {
    const { getByTestId } = render(
      <Provider>
        <MemoryRouter initialEntries={['/to/%40alice%3Aexample/!room%3Aexample/%24event123']}>
          <Routes>
            <Route path="/to/:user_id/:room_id/:event_id?" element={<ToRoomEvent />} />
            <Route path="/" element={<div />} />
          </Routes>
          <AtomProbe />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      const payload = JSON.parse(getByTestId('probe').textContent ?? '{}') as {
        pendingNotification?: {
          jumpMode?: string;
        };
      };

      expect(payload.pendingNotification?.jumpMode).toBe('history_context');
    });
  });
});
