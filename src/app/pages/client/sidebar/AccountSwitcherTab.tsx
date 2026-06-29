import type { MouseEvent, MouseEventHandler, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import type { RectCords } from 'folds';
import {
  Badge,
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  Scroll,
  Text,
  config,
  toRem,
  Chip,
  Spinner,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Modal500 } from '$components/Modal500';
import type { Session } from '$state/sessions';
import { sessionsAtom, activeSessionIdAtom, backgroundUnreadCountsAtom } from '$state/sessions';
import {
  SidebarItemTooltip,
  SidebarAvatar,
  SidebarUnreadBadge,
  SidebarItem,
} from '$components/sidebar';
import { UserAvatar } from '$components/user-avatar';
import { nameInitials } from '$utils/common';
import { getMxIdLocalPart, mxcUrlToHttp } from '$utils/matrix';
import { stopPropagation } from '$utils/keyboard';
import { reloadWithTelemetry } from '$utils/reloadWithTelemetry';
import { getHomePath, getLoginPath, withSearchParam } from '$pages/pathUtils';
import { logoutClient, initClient, stopClient } from '$client/initMatrix';
import { useMatrixClient } from '$hooks/useMatrixClient';
import { useUserProfile } from '$hooks/useUserProfile';
import { useMediaAuthentication } from '$hooks/useMediaAuthentication';
import { useSessionProfiles } from '$hooks/useSessionProfiles';
import { useOpenSettings } from '$features/settings/useOpenSettings';
import { createLogger } from '$utils/debug';
import { createDebugLogger } from '$utils/debugLogger';
import { useClientConfig } from '$hooks/useClientConfig';
import { UnreadBadge, UnreadBadgeCenter } from '$components/unread-badge';
import type { Presence } from '$hooks/useUserPresence';
import { AvatarPresence, PresenceBadge } from '$components/presence';
import { useSetting } from '$state/hooks/settings';
import { settingsAtom, presenceAutoIdledAtom } from '$state/settings';
import { ScreenSize, useScreenSizeContext } from '$hooks/useScreenSize';
import { isPhoneLayoutDevice } from '$utils/user-agent';
import {
  Check,
  chipIcon,
  composerIcon,
  GearSix,
  menuIcon,
  Plus,
  X,
} from '$components/icons/phosphor';
import { usePathWithOrigin } from '$hooks/usePathWithOrigin';

const log = createLogger('AccountSwitcherTab');
const debugLog = createDebugLogger('AccountSwitcherTab');

const sectionHeaderStyle = {
  padding: `${config.space.S100} ${config.space.S200}`,
};

const sectionMenuStyle = {
  minWidth: toRem(256),
};

const sectionMenuContentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
};

const sectionListStyle = {
  padding: config.space.S100,
  borderRadius: config.radii.R400,
  background: 'var(--sable-surface-container)',
};

const mobileMenuViewportPadding = 12;
const safeAreaInlineStart = 'var(--sable-safe-area-left, env(safe-area-inset-left, 0px))';
const safeAreaInlineEnd = 'var(--sable-safe-area-right, env(safe-area-inset-right, 0px))';
// --sable-safe-area-bottom is intentionally 0px in SystemBarShell (room views own
// their own spacing). Use env() directly so fixed overlays like the sheet get the
// real home-indicator / browser-bottom inset.
const safeAreaBottomInset = 'env(safe-area-inset-bottom, 0px)';

const getAccountSwitcherMenuMaxHeight = (menuAnchor?: RectCords, isBottom?: boolean): string => {
  const viewportCap =
    typeof window === 'undefined' ? undefined : Math.floor(window.innerHeight * 0.85);

  if (!menuAnchor || !isBottom) return viewportCap ? `${viewportCap}px` : '85vh';

  const availableAboveTrigger = Math.max(menuAnchor.y - mobileMenuViewportPadding, 0);
  const cappedHeight =
    viewportCap === undefined
      ? availableAboveTrigger
      : Math.min(viewportCap, availableAboveTrigger);

  return `${Math.floor(cappedHeight)}px`;
};

function AccountRow({
  session,
  isActive,
  displayName,
  avatarUrl,
  isBusy,
  unread,
  onSwitch,
  onSignOut,
}: {
  session: Session;
  isActive: boolean;
  displayName?: string;
  avatarUrl?: string;
  isBusy?: boolean;
  unread?: { total: number; highlight: number };
  onSwitch: (session: Session) => void;
  onSignOut: (session: Session) => void;
}) {
  const localPart = getMxIdLocalPart(session.userId) ?? session.userId;
  const server = session.userId.split(':')[1] ?? session.baseUrl;
  const label = displayName ?? localPart;

  return (
    <MenuItem
      size="400"
      radii="300"
      style={{
        opacity: isBusy ? 0.6 : undefined,
        height: 'auto',
      }}
      before={
        <SidebarAvatar size="200" style={{ width: toRem(28), height: toRem(28) }}>
          <UserAvatar
            userId={session.userId}
            src={avatarUrl}
            alt={label}
            renderFallback={() => <Text size="H6">{nameInitials(label)}</Text>}
          />
        </SidebarAvatar>
      }
      after={
        <Box gap="200" alignItems="Center" shrink="No">
          {!isActive && unread && unread.total > 0 && (
            <UnreadBadgeCenter>
              <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
            </UnreadBadgeCenter>
          )}
          {isActive && chipIcon(Check, { style: { color: 'var(--mx-c-success)' } })}
          {isBusy ? (
            <Spinner size="200" variant="Secondary" />
          ) : (
            <Chip
              variant="Critical"
              fill="None"
              size="400"
              radii="300"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onSignOut(session);
              }}
            >
              <Text size="T200">Sign out</Text>
            </Chip>
          )}
        </Box>
      }
      onClick={() => !isActive && !isBusy && onSwitch(session)}
    >
      <Box
        direction="Column"
        grow="Yes"
        style={{
          paddingTop: config.space.S100,
          paddingBottom: config.space.S100,
          justifyContent: 'Center',
        }}
      >
        <Text size="T300" truncate>
          {label}
        </Text>
        <Text size="T200" priority="300" truncate>
          {isActive ? session.userId : server}
        </Text>
      </Box>
    </MenuItem>
  );
}

export function AccountSwitcherTab({ isBottom }: { isBottom?: boolean }) {
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const navigate = useNavigate();
  const sessions = useAtomValue(sessionsAtom);
  const [activeSessionId, setActiveSessionId] = useAtom(activeSessionIdAtom);
  const setSessions = useSetAtom(sessionsAtom);
  const useAuthentication = useMediaAuthentication();
  const backgroundUnreads = useAtomValue(backgroundUnreadCountsAtom);
  const setBackgroundUnreads = useSetAtom(backgroundUnreadCountsAtom);
  const openSettings = useOpenSettings();

  // Total unread count across all background sessions (for the sidebar badge).
  const totalBackgroundUnread = Object.entries(backgroundUnreads)
    .filter(([uid]) => uid !== (activeSessionId ?? sessions[0]?.userId))
    .reduce((acc, [, u]) => acc + u.total, 0);
  const totalBackgroundHighlight = Object.entries(backgroundUnreads)
    .filter(([uid]) => uid !== (activeSessionId ?? sessions[0]?.userId))
    .reduce((acc, [, u]) => acc + u.highlight, 0);
  const anyBackgroundHighlight = totalBackgroundHighlight > 0;

  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [busyUserIds, setBusyUserIds] = useState(new Set());
  const [confirmSignOutSession, setConfirmSignOutSession] = useState<Session | undefined>(
    undefined
  );

  const activeSession = sessions.find((s) => s.userId === activeSessionId) ?? sessions[0];

  const myUserId = mx.getUserId() ?? '';
  const activeProfile = useUserProfile(myUserId);
  const activeAvatarUrl = activeProfile.avatarUrl
    ? (mxcUrlToHttp(mx, activeProfile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined)
    : undefined;
  const activeDisplayName = activeProfile.displayName;

  // Own presence badge is driven from settings state rather than the SDK's User object.
  // The SDK won't echo your own presence back on MSC4186 sliding sync, so reading
  // user.presence would leave the badge stuck at the SDK default forever.
  const [sendPresence, setSendPresence] = useSetting(settingsAtom, 'sendPresence');
  const [presenceMode, setPresenceMode] = useSetting(settingsAtom, 'presenceMode');
  const [focusMode, setFocusMode] = useSetting(settingsAtom, 'focusMode');
  const autoIdled = useAtomValue(presenceAutoIdledAtom);
  const setAutoIdled = useSetAtom(presenceAutoIdledAtom);
  // The effective mode for badge display: if auto-idled, show unavailable regardless of selected mode.
  const effectiveDisplayMode = autoIdled ? 'unavailable' : (presenceMode ?? 'online');
  let myOwnPresenceBadge: ReactNode;
  if (sendPresence) {
    myOwnPresenceBadge = (
      <PresenceBadge
        key={effectiveDisplayMode}
        presence={effectiveDisplayMode as Presence}
        size="200"
      />
    );
  }

  const sessionProfiles = useSessionProfiles(sessions);

  const { disableAccountSwitcher } = useClientConfig();

  const loginUrl = usePathWithOrigin(getLoginPath());

  const handleToggle: MouseEventHandler<HTMLButtonElement> = (evt) => {
    if (disableAccountSwitcher) {
      openSettings();
      return;
    }
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((cur) => (cur ? undefined : cords));
  };

  const handleSwitch = useCallback(
    (session: Session) => {
      log.log('switching to account', session.userId);
      setMenuAnchor(undefined);
      navigate(getHomePath(), { replace: true });
      setActiveSessionId(session.userId);
      // Clear the unread badge for the account we're now switching into.
      setBackgroundUnreads((prev) => {
        const next = { ...prev };
        delete next[session.userId];
        return next;
      });
    },
    [navigate, setActiveSessionId, setBackgroundUnreads]
  );

  const handleSignOut = useCallback(
    async (session: Session) => {
      log.log('signing out', session.userId);
      setMenuAnchor(undefined);
      setBusyUserIds((prev) => new Set(prev).add(session.userId));
      try {
        if (session.userId === mx.getUserId()) {
          await logoutClient(mx, session);
          setSessions({ type: 'DELETE', session });
          setActiveSessionId(
            sessions.find((s) => s.userId !== session.userId)?.userId ?? undefined
          );
          reloadWithTelemetry('logout_from_account_switcher', {
            userId: session.userId,
          });
        } else {
          try {
            const tempMx = await initClient(session);
            await logoutClient(tempMx, session);
          } catch (err) {
            log.error('failed to logout background session, IndexedDB may remain', err);
            debugLog.error('general', 'Failed to logout background session', {
              userId: session.userId,
              error: err instanceof Error ? err.message : String(err),
            });
            Sentry.captureException(err, {
              tags: { operation: 'logout_background_session' },
              contexts: {
                account: {
                  userId: session.userId,
                },
              },
            });
          }
          setSessions({ type: 'DELETE', session });
          if (activeSessionId === session.userId) {
            setActiveSessionId(
              sessions.find((s) => s.userId !== session.userId)?.userId ?? undefined
            );
          }
        }
      } catch (err) {
        log.error('Logout failed', err);
        debugLog.error('general', 'Account logout failed', {
          userId: session.userId,
          isActiveSession: activeSessionId === session.userId,
          error: err instanceof Error ? err.message : String(err),
        });
        Sentry.captureException(err, {
          tags: { operation: 'logout' },
          contexts: {
            account: {
              userId: session.userId,
              isActiveSession: activeSessionId === session.userId,
            },
          },
        });
      } finally {
        setBusyUserIds((prev) => {
          const next = new Set(prev);
          next.delete(session.userId);
          return next;
        });
      }
    },
    [mx, sessions, activeSessionId, setSessions, setActiveSessionId]
  );

  const handleAddAccount = () => {
    const url = withSearchParam(loginUrl, { addAccount: '1' });
    setMenuAnchor(undefined);
    void stopClient(mx).finally(() => {
      window.location.assign(url);
    });
  };

  const handleOpenSettings = () => {
    setMenuAnchor(undefined);
    openSettings();
  };

  const activeLocalPart =
    getMxIdLocalPart(activeSession?.userId ?? '') ?? activeSession?.userId ?? '';
  const label = activeDisplayName ?? activeLocalPart;
  const sectionMenuMaxHeight = getAccountSwitcherMenuMaxHeight(menuAnchor, isBottom);
  const isPhoneLayout = screenSize === ScreenSize.Mobile || isPhoneLayoutDevice();
  const useModalAccountSwitcher = isPhoneLayout;

  if (!activeSession) return null;

  const accountSwitcherSections = (
    <Box direction="Column" gap="100">
      <Text size="L400" priority="300" style={sectionHeaderStyle}>
        Accounts
      </Text>
      <Box direction="Column" gap="100" style={sectionListStyle}>
        {sessions.map((session) => {
          const isActive = session.userId === (activeSessionId ?? sessions[0]?.userId);
          let rowDisplayName: string | undefined;
          let rowAvatarUrl: string | undefined;
          if (isActive) {
            rowDisplayName = activeDisplayName;
            rowAvatarUrl = activeAvatarUrl;
          } else {
            const prof = sessionProfiles[session.userId];
            rowDisplayName = prof?.displayName;
            rowAvatarUrl = prof?.avatarHttpUrl;
          }
          return (
            <AccountRow
              key={session.userId}
              session={session}
              isActive={isActive}
              displayName={rowDisplayName}
              avatarUrl={rowAvatarUrl}
              isBusy={busyUserIds.has(session.userId)}
              unread={!isActive ? backgroundUnreads[session.userId] : undefined}
              onSwitch={handleSwitch}
              onSignOut={(pendingSession) => {
                setMenuAnchor(undefined);
                setConfirmSignOutSession(pendingSession);
              }}
            />
          );
        })}
        <MenuItem size="300" radii="300" before={chipIcon(Plus)} onClick={handleAddAccount}>
          <Text size="T300">Add Account</Text>
        </MenuItem>
      </Box>
      <Text size="L400" priority="300" style={sectionHeaderStyle}>
        Status
      </Text>
      <Box direction="Column" gap="100" style={sectionListStyle}>
        {(
          [
            {
              label: 'Online',
              desc: undefined,
              mode: 'online' as const,
            },
            {
              label: 'Idle',
              desc: undefined,
              mode: 'unavailable' as const,
            },
            {
              label: 'Do Not Disturb',
              desc: undefined,
              mode: 'dnd' as const,
            },
            {
              label: 'Invisible',
              desc: 'You will appear offline',
              mode: 'offline' as const,
            },
          ] as const
        ).map(({ label: statusLabel, desc, mode }) => {
          const isSelected = sendPresence && (presenceMode ?? 'online') === mode;
          const badge =
            mode === 'dnd' ? (
              <Badge size="300" variant="Critical" fill="Solid" radii="Pill" />
            ) : (
              <PresenceBadge presence={mode as Presence} size="300" />
            );
          return (
            <MenuItem
              key={mode}
              size="300"
              radii="300"
              before={badge}
              after={
                isSelected ? (
                  <Icon size="200" src={Icons.Check} style={{ color: 'var(--mx-c-success)' }} />
                ) : undefined
              }
              onClick={() => {
                setPresenceMode(mode);
                setAutoIdled(false);
                if (!sendPresence) setSendPresence(true);
              }}
            >
              <Box direction="Column">
                <Text size="T300">{statusLabel}</Text>
                {desc && (
                  <Text size="T200" priority="300">
                    {desc}
                  </Text>
                )}
              </Box>
            </MenuItem>
          );
        })}
      </Box>
      <Box gap="100" direction="Column" style={{ marginTop: config.space.S100 }}>
        <Text size="O400" priority="300" style={sectionHeaderStyle}>
          Focus Mode
        </Text>
        <Box direction="Column" gap="100" style={sectionListStyle}>
          {[
            {
              mode: 'off' as const,
              label: 'Off',
              description: 'All notifications',
            },
            {
              mode: 'focus' as const,
              label: 'Focus',
              description: 'DMs and mentions only',
            },
            {
              mode: 'dnd' as const,
              label: 'Do Not Disturb',
              description: 'Critical messages only',
            },
          ].map(({ mode, label: modeLabel, description }) => {
            const isSelected = focusMode === mode;
            return (
              <MenuItem
                key={mode}
                size="300"
                radii="300"
                after={isSelected ? <Icon size="200" src={Icons.Check} /> : undefined}
                aria-pressed={isSelected}
                onClick={() => {
                  setFocusMode(mode);
                }}
              >
                <Box direction="Column" gap="100">
                  <Text size="T300">{modeLabel}</Text>
                  <Text size="T200" priority="300">
                    {description}
                  </Text>
                </Box>
              </MenuItem>
            );
          })}
        </Box>
      </Box>
    </Box>
  );

  const settingsFooter = (
    <Box
      direction="Column"
      gap="100"
      style={{
        paddingTop: 0,
        paddingBottom: `calc(${config.space.S100} + ${safeAreaBottomInset})`,
        paddingLeft: `calc(${safeAreaInlineStart} + ${config.space.S100})`,
        paddingRight: `calc(${safeAreaInlineEnd} + ${config.space.S100})`,
      }}
    >
      <Box direction="Column" gap="100" style={sectionListStyle}>
        <MenuItem size="300" radii="300" before={menuIcon(GearSix)} onClick={handleOpenSettings}>
          <Text size="T300">App Settings</Text>
        </MenuItem>
      </Box>
    </Box>
  );

  return (
    <SidebarItem active={!!menuAnchor} isBottom={isBottom}>
      <SidebarItemTooltip tooltip={label} position={isBottom ? 'Top' : 'Right'}>
        {(triggerRef) => (
          <AvatarPresence badge={myOwnPresenceBadge}>
            <SidebarAvatar
              as="button"
              ref={triggerRef}
              onClick={handleToggle}
              outlined={sessions.length > 1}
            >
              <UserAvatar
                userId={activeSession.userId}
                src={activeAvatarUrl}
                alt={label}
                renderFallback={() => <Text size="H4">{nameInitials(label)}</Text>}
              />
            </SidebarAvatar>
          </AvatarPresence>
        )}
      </SidebarItemTooltip>
      {(totalBackgroundUnread > 0 || anyBackgroundHighlight) && (
        <SidebarUnreadBadge
          highlight={anyBackgroundHighlight}
          count={anyBackgroundHighlight ? totalBackgroundHighlight : totalBackgroundUnread}
        />
      )}

      {useModalAccountSwitcher ? (
        menuAnchor && (
          <Modal500 requestClose={() => setMenuAnchor(undefined)} sheetOnMobile>
            <Box
              direction="Column"
              style={{ height: '100%', maxHeight: '100%', overflow: 'hidden' }}
            >
              <Header
                style={{
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: `calc(${safeAreaInlineStart} + ${config.space.S400})`,
                  paddingRight: `calc(${safeAreaInlineEnd} + ${config.space.S200})`,
                  borderBottomWidth: config.borderWidth.B300,
                }}
                variant="Surface"
                size="500"
              >
                <Box grow="Yes">
                  <Text size="H4">Accounts</Text>
                </Box>
                <IconButton size="300" radii="300" onClick={() => setMenuAnchor(undefined)}>
                  {composerIcon(X)}
                </IconButton>
              </Header>
              <Scroll
                hideTrack
                size="0"
                visibility="Hover"
                style={{
                  flex: 1,
                  minHeight: 0,
                  paddingTop: config.space.S100,
                  paddingBottom: config.space.S100,
                  paddingLeft: `calc(${safeAreaInlineStart} + ${config.space.S100})`,
                  paddingRight: `calc(${safeAreaInlineEnd} + ${config.space.S100})`,
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {accountSwitcherSections}
              </Scroll>
              {settingsFooter}
            </Box>
          </Modal500>
        )
      ) : (
        <PopOut
          anchor={menuAnchor}
          position={isBottom ? 'Top' : 'Right'}
          align={isBottom ? 'Start' : 'End'}
          offset={6}
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: () => setMenuAnchor(undefined),
                clickOutsideDeactivates: true,
                isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                escapeDeactivates: stopPropagation,
              }}
            >
              <Menu
                style={{
                  ...sectionMenuStyle,
                  ...sectionMenuContentStyle,
                  maxHeight: sectionMenuMaxHeight,
                }}
              >
                <Scroll
                  hideTrack
                  size="0"
                  visibility="Hover"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: config.space.S100,
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {accountSwitcherSections}
                </Scroll>
                {settingsFooter}
              </Menu>
            </FocusTrap>
          }
        />
      )}

      {confirmSignOutSession && (
        <Overlay open backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                fallbackFocus: () => document.body,
                clickOutsideDeactivates: true,
                onDeactivate: () => setConfirmSignOutSession(undefined),
                escapeDeactivates: stopPropagation,
              }}
            >
              <Dialog variant="Surface">
                <Header
                  style={{
                    padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                    borderBottomWidth: config.borderWidth.B300,
                  }}
                  variant="Surface"
                  size="500"
                >
                  <Box grow="Yes">
                    <Text size="H4">Sign out</Text>
                  </Box>
                </Header>
                <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                  <Text priority="400">
                    Are you sure you want to sign out of <b>{confirmSignOutSession.userId}</b>?
                  </Text>
                  <Box direction="Column" gap="200">
                    <Button
                      variant="Critical"
                      onClick={() => {
                        handleSignOut(confirmSignOutSession);
                        setConfirmSignOutSession(undefined);
                      }}
                    >
                      <Text size="B400">Sign out</Text>
                    </Button>
                    <Button variant="Secondary" onClick={() => setConfirmSignOutSession(undefined)}>
                      <Text size="B400">Cancel</Text>
                    </Button>
                  </Box>
                </Box>
              </Dialog>
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}
    </SidebarItem>
  );
}
