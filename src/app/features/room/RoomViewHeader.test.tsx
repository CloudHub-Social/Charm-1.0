/**
 * Regression coverage for #513 (fix(a11y): label icon-only nav buttons and
 * enlarge mobile touch targets).
 *
 * Before that fix, RoomViewHeader's back/search/pin/more-options buttons
 * rendered with NO accessible name at all (aria-label: null, title: "",
 * text: "") — a screen reader announced them only as "button". These tests
 * mount the REAL RoomViewHeader (not a synthetic fixture) against a REAL
 * matrix-js-sdk MatrixClient + Room (populated in-memory, no network/crypto/
 * IndexedDB), and assert each button is findable by accessible role+name via
 * `getByRole`, the same mechanism assistive tech uses. A plain aria-label
 * attribute check would not have caught the original bug's failure mode as
 * precisely, since `getByRole` fails outright when there's no accessible name.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, MatrixEvent, Room } from '$types/matrix-sdk';
import { MatrixClientProvider } from '$hooks/useMatrixClient';
import { RoomProvider, IsDirectRoomProvider } from '$hooks/useRoom';
import { ClientConfigProvider } from '$hooks/useClientConfig';
import { ScreenSize, ScreenSizeProvider } from '$hooks/useScreenSize';
import { SpecVersionsProvider } from '$hooks/useSpecVersions';
import { ThemeContextProvider, ThemeKind } from '$hooks/useTheme';
import { makeCallPreferencesAtom } from '$state/callPreferences';
import { CallPreferencesProvider } from '$state/hooks/callPreferences';
import { AutoDiscoveryInfoProvider } from '$hooks/useAutoDiscoveryInfo';
import { RoomViewHeader } from './RoomViewHeader';

// RoomCallButton pulls in the call-embedding subsystem (CallEmbedRef context,
// CallPreferences atom context, MatrixRTC session wiring, etc.) — a large,
// unrelated feature tree that has nothing to do with the a11y label fix under
// test here. Stub it the same way the repo's other component tests stub
// unrelated features (see Settings.test.tsx), rather than dragging its whole
// provider chain into a test that's only asserting header button labels.
vi.mock('./RoomCallButton', () => ({
  RoomCallButton: () => null,
}));

const ROOM_ID = '!room:smoke.test';
const USER_ID = '@smoke:smoke.test';

/**
 * Builds a real matrix-js-sdk MatrixClient (in-memory MemoryStore, no
 * network/crypto/IndexedDB) with a real Room registered on it, populated
 * with just enough state + timeline data for RoomViewHeader to render.
 * Using the real SDK classes (rather than hand-rolled fakes) means
 * getLiveTimeline(), getAccountData(), getMyMembership(), event-emitter
 * subscriptions, etc. all behave like production.
 */
function buildRoomFixture() {
  const mx = createClient({
    baseUrl: 'https://smoke.test',
    userId: USER_ID,
    accessToken: 'smoke-token',
    deviceId: 'SMOKEDEVICE',
  });

  const room = new Room(ROOM_ID, mx, USER_ID, {
    pendingEventOrdering: 'detached' as never,
  });

  const mkStateEvent = (
    type: string,
    content: Record<string, unknown>,
    stateKey: string,
    sender = USER_ID
  ) =>
    new MatrixEvent({
      type,
      event_id: `$${type}-${stateKey || 'root'}`,
      room_id: ROOM_ID,
      sender,
      state_key: stateKey,
      content,
      origin_server_ts: Date.now(),
    });

  const stateEvents = [
    mkStateEvent('m.room.create', { creator: USER_ID, room_version: '10' }, ''),
    mkStateEvent('m.room.member', { membership: 'join', displayname: 'Smoke' }, USER_ID),
    mkStateEvent('m.room.name', { name: 'Regression Test Room' }, ''),
    mkStateEvent(
      'm.room.power_levels',
      {
        users: { [USER_ID]: 100 },
        users_default: 0,
        state_default: 50,
        events_default: 0,
      },
      ''
    ),
  ];

  room.currentState.setStateEvents(stateEvents);
  room.oldState.setStateEvents(stateEvents);
  room.updateMyMembership('join');

  // A timeline event (of any kind) is enough for RoomViewHeader's thread-scan
  // effect and unread-count logic to have something to operate on; the
  // specific content doesn't matter for the button-label assertions below.
  const textMessage = new MatrixEvent({
    type: 'm.room.message',
    event_id: '$text-message',
    room_id: ROOM_ID,
    sender: USER_ID,
    content: { msgtype: 'm.text', body: 'Hello from the regression fixture' },
    origin_server_ts: Date.now(),
  });
  room.addLiveEvents([textMessage], { addToState: false });

  mx.store.storeRoom(room);

  return { mx, room };
}

function renderRoomViewHeader(screenSize: ScreenSize = ScreenSize.Desktop) {
  const { mx, room } = buildRoomFixture();
  // RoomViewHeader reads call preferences and call-start capabilities
  // directly (not just via the mocked RoomCallButton), so both providers
  // must be present even though this test never exercises call
  // functionality itself.
  const callPreferencesAtom = makeCallPreferencesAtom(USER_ID);
  const autoDiscoveryInfo = { 'm.homeserver': { base_url: 'https://smoke.test' } };

  render(
    <JotaiProvider>
      <MemoryRouter initialEntries={[`/home/room/${encodeURIComponent(ROOM_ID)}`]}>
        <SpecVersionsProvider value={{ versions: ['v1.11'] }}>
          <ClientConfigProvider value={{}}>
            <ScreenSizeProvider value={screenSize}>
              <ThemeContextProvider
                value={{ id: 'sable-light', kind: ThemeKind.Light, classNames: [] }}
              >
                <MatrixClientProvider value={mx}>
                  <RoomProvider value={room}>
                    <IsDirectRoomProvider value={false}>
                      <CallPreferencesProvider value={callPreferencesAtom}>
                        <AutoDiscoveryInfoProvider value={autoDiscoveryInfo}>
                          <RoomViewHeader />
                        </AutoDiscoveryInfoProvider>
                      </CallPreferencesProvider>
                    </IsDirectRoomProvider>
                  </RoomProvider>
                </MatrixClientProvider>
              </ThemeContextProvider>
            </ScreenSizeProvider>
          </ClientConfigProvider>
        </SpecVersionsProvider>
      </MemoryRouter>
    </JotaiProvider>
  );

  return { mx, room };
}

describe('RoomViewHeader accessible button labels', () => {
  beforeAll(() => {
    // folds' PopOut/Tooltip primitives read layout via getBoundingClientRect;
    // jsdom returns zeroes by default which is fine for these assertions
    // (we only check presence/role/name, not geometry).
    if (!('ResizeObserver' in globalThis)) {
      class ResizeObserverStub {
        observe() {}

        unobserve() {}

        disconnect() {}
      }
      globalThis.ResizeObserver = ResizeObserverStub;
    }
  });

  it('exposes the back button with an accessible role and name (mobile layout)', () => {
    // The back button only renders on the mobile screen-size breakpoint —
    // desktop uses the persistent room list nav instead.
    renderRoomViewHeader(ScreenSize.Mobile);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('exposes the search button with an accessible role and name', () => {
    renderRoomViewHeader();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('exposes the pinned messages button with an accessible role and name', () => {
    renderRoomViewHeader();
    expect(screen.getByRole('button', { name: 'Pinned Messages' })).toBeInTheDocument();
  });

  it('exposes the more-options button with an accessible role and name', () => {
    renderRoomViewHeader();
    expect(screen.getByRole('button', { name: 'More Options' })).toBeInTheDocument();
  });
});
