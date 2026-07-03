/**
 * Regression coverage for #530 (Touch Spacing toggle). RoomInput.tsx wires
 * `showTouchSpacing` into a `touchTargetSize` ('500' | '300') that is passed
 * as the `size` prop to eleven IconButtons across the composer. This suite
 * mounts the REAL RoomInput (not a synthetic fixture) against a REAL
 * matrix-js-sdk MatrixClient + Room (in-memory MemoryStore, no network/
 * crypto/IndexedDB), following the same philosophy established in #513's
 * RoomViewHeader.test.tsx: synthetic fixtures don't render the real
 * components and can't regression-guard real behavior.
 *
 * RoomInput pulls in ~20 unrelated subsystems (file pickers, commands,
 * scheduled sends, pluralkit proxying, Sentry telemetry, etc.) that have
 * nothing to do with touch-target sizing. Those are mocked out wholesale,
 * mirroring how RoomViewHeader.test.tsx stubs `./RoomCallButton` as "a
 * large, unrelated feature tree." What's kept real: the editor (via the
 * public `useEditor()` hook, same as Editor.test.tsx's harness pattern),
 * the Matrix client/room, and the jotai settings store (seeded directly,
 * since `settingsAtom`'s default is computed once at module load and
 * `localStorage` mutations after that point have no effect).
 *
 * jsdom doesn't perform layout, so `getBoundingClientRect()` always returns
 * zeroes — pixel dimensions can't be asserted directly here. What CAN be
 * asserted: that toggling `showTouchSpacing` changes which folds IconButton
 * `size` recipe class a button receives, without hardcoding the actual
 * (folds-version-specific) class name/hash.
 */
import type { RefObject } from 'react';
import { render, screen } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, MatrixEvent, Room } from '$types/matrix-sdk';
import { MatrixClientProvider } from '$hooks/useMatrixClient';
import { RoomProvider } from '$hooks/useRoom';
import { ClientConfigProvider } from '$hooks/useClientConfig';
import { PowerLevelsContextProvider, type IPowerLevels } from '$hooks/usePowerLevels';
import { getSettings, settingsAtom, type Settings } from '$state/settings';
import { useEditor } from '$components/editor/Editor';
import type * as UseCommandsModule from '$hooks/useCommands';
import { RoomInput } from './RoomInput';

// The following hooks/subsystems are unrelated to touch-target sizing —
// they cover file pickers, slash commands, typing indicators, scheduled
// sends, pluralkit proxying, and iOS keyboard handling. Mocking them keeps
// this suite focused on the Add/Mic/Emoji/Send buttons' `size` prop without
// dragging in their full provider/behavior chains.
vi.mock('$hooks/useTypingStatusUpdater', () => ({
  useTypingStatusUpdater: () => vi.fn<() => void>(),
}));

vi.mock('$hooks/useFilePicker', () => ({
  useFilePicker: () => vi.fn<() => void>(),
}));

vi.mock('$hooks/useFilePasteHandler', () => ({
  useFilePasteHandler: () => vi.fn<() => void>(),
}));

vi.mock('$hooks/useFileDrop', () => ({
  useFileDropHandler: () => vi.fn<() => void>(),
  useFileDropZone: () => false,
}));

vi.mock('$hooks/useCommands', async (importOriginal) => {
  const actual = await importOriginal<typeof UseCommandsModule>();
  return {
    ...actual,
    useCommands: () => ({}),
  };
});

vi.mock('$hooks/useElementSizeObserver', () => ({
  useElementSizeObserver: () => undefined,
}));

vi.mock('$hooks/useMediaAuthentication', () => ({
  useMediaAuthentication: () => false,
}));

vi.mock('$hooks/useImagePackRooms', () => ({
  useImagePackRooms: () => [],
}));

vi.mock('$hooks/useComposingCheck', () => ({
  useComposingCheck: () => false,
}));

vi.mock('$hooks/useRoomCreators', () => ({
  useRoomCreators: () => new Set<string>(),
}));

vi.mock('$hooks/useRoomPermissions', () => ({
  useRoomPermissions: () => ({
    event: () => true,
    state: () => true,
    other: () => true,
  }),
}));

vi.mock('$features/settings/useSettingsLinkBaseUrl', () => ({
  useSettingsLinkBaseUrl: () => 'https://smoke.test',
}));

vi.mock('$hooks/ios-keyboard-fix', () => ({
  useKeyboardHeight: () => ({ triggerPreLift: vi.fn<() => void>() }),
  useScrollLock: () => undefined,
}));

vi.mock('$plugins/pluralkit-handler/PKitCommandMessageHandler', () => ({
  PKitCommandMessageHandler: class {
    // eslint-disable-next-line class-methods-use-this
    init() {}
  },
}));

vi.mock('$plugins/pluralkit-handler/PKitProxyMessageHandler', () => ({
  PKitProxyMessageHandler: class {
    // eslint-disable-next-line class-methods-use-this
    init() {}
  },
}));

const ROOM_ID = '!room:smoke.test';
const USER_ID = '@smoke:smoke.test';

/**
 * Builds a real matrix-js-sdk MatrixClient (in-memory MemoryStore, no
 * network/crypto/IndexedDB) with a real Room registered on it, populated
 * with just enough state for RoomInput to render.
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

  mx.store.storeRoom(room);

  return { mx, room };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const defaultPowerLevels: Required<IPowerLevels> = {
  users_default: 0,
  state_default: 50,
  events_default: 0,
  invite: 0,
  redact: 50,
  kick: 50,
  ban: 50,
  historical: 0,
  events: {},
  users: {},
  notifications: { room: 50 },
};

/** Tiny harness mirroring Editor.test.tsx's EditorHarness pattern: RoomInput
 * needs a real Slate `Editor` instance, which the public `useEditor()` hook
 * (from $components/editor/Editor) provides. */
function RoomInputHarness({
  room,
  settingsOverrides,
}: {
  room: Room;
  settingsOverrides?: Partial<Settings>;
}) {
  const editor = useEditor();
  const fileDropContainerRef = { current: null } as RefObject<HTMLElement>;
  const store = createStore();
  store.set(settingsAtom, { ...getSettings(), ...settingsOverrides });

  return (
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ClientConfigProvider value={{}}>
          <PowerLevelsContextProvider value={defaultPowerLevels}>
            <RoomInput
              editor={editor}
              fileDropContainerRef={fileDropContainerRef}
              roomId={room.roomId}
              room={room}
            />
          </PowerLevelsContextProvider>
        </ClientConfigProvider>
      </QueryClientProvider>
    </JotaiProvider>
  );
}

function renderRoomInput(settingsOverrides?: Partial<Settings>) {
  const { mx, room } = buildRoomFixture();

  const result = render(
    <MatrixClientProvider value={mx}>
      <RoomProvider value={room}>
        <RoomInputHarness room={room} settingsOverrides={settingsOverrides} />
      </RoomProvider>
    </MatrixClientProvider>
  );

  return { mx, room, unmount: result.unmount };
}

describe('RoomInput Touch Spacing sizing', () => {
  beforeAll(() => {
    if (!('ResizeObserver' in globalThis)) {
      class ResizeObserverStub {
        observe() {}

        unobserve() {}

        disconnect() {}
      }
      globalThis.ResizeObserver = ResizeObserverStub;
    }
  });

  it('renders the composer send affordance with Touch Spacing at its default (on)', () => {
    renderRoomInput();
    expect(screen.getByRole('button', { name: 'Send your composed Message' })).toBeInTheDocument();
  });

  it('applies a different IconButton size class to the Add button when Touch Spacing is off', () => {
    const on = renderRoomInput({ showTouchSpacing: true });
    const onClassName = screen.getByRole('button', { name: 'Add new Item' }).className;
    on.unmount();

    renderRoomInput({ showTouchSpacing: false });
    const offClassName = screen.getByRole('button', { name: 'Add new Item' }).className;

    expect(offClassName).not.toBe(onClassName);
  });

  it('applies a different IconButton size class to the Mic button when Touch Spacing is off', () => {
    const on = renderRoomInput({ showTouchSpacing: true });
    const onClassName = screen.getByRole('button', { name: 'Record audio message' }).className;
    on.unmount();

    renderRoomInput({ showTouchSpacing: false });
    const offClassName = screen.getByRole('button', { name: 'Record audio message' }).className;

    expect(offClassName).not.toBe(onClassName);
  });

  it('applies a different IconButton size class to the Emoji button when Touch Spacing is off', () => {
    const on = renderRoomInput({ showTouchSpacing: true });
    const onClassName = screen.getByRole('button', { name: 'Open emoji picker' }).className;
    on.unmount();

    renderRoomInput({ showTouchSpacing: false });
    const offClassName = screen.getByRole('button', { name: 'Open emoji picker' }).className;

    expect(offClassName).not.toBe(onClassName);
  });

  it('applies a different IconButton size class to the Send button when Touch Spacing is off', () => {
    const on = renderRoomInput({ showTouchSpacing: true });
    const onClassName = screen.getByRole('button', {
      name: 'Send your composed Message',
    }).className;
    on.unmount();

    renderRoomInput({ showTouchSpacing: false });
    const offClassName = screen.getByRole('button', {
      name: 'Send your composed Message',
    }).className;

    expect(offClassName).not.toBe(onClassName);
  });
});
