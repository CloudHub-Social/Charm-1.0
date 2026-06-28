import { type CSSProperties, type ReactNode } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { type as osType } from '@tauri-apps/plugin-os';
import { mobileOrTablet } from '$utils/user-agent';
import { useSystemBarStyle } from './useSystemBarStyle';

const safeAreaTop = 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))';
const safeAreaBottom = 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))';
const safeAreaLeft = 'var(--safe-area-inset-left, env(safe-area-inset-left, 0px))';
const safeAreaRight = 'var(--safe-area-inset-right, env(safe-area-inset-right, 0px))';

type SystemBarStripProps = {
  position: 'top' | 'bottom';
  size: string;
};

function SystemBarStrip({ position, size }: SystemBarStripProps) {
  return (
    <div
      style={{
        height: size,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--sable-bg-container)',
          ...(position === 'top'
            ? { borderBottom: '1px solid var(--sable-bg-container-line)' }
            : { borderTop: '1px solid var(--sable-bg-container-line)' }),
        }}
      />
    </div>
  );
}

type SystemBarShellProps = {
  children: ReactNode;
  onPortalContainerChange: (node: HTMLDivElement | null) => void;
};

export function SystemBarShell({ children, onPortalContainerChange }: SystemBarShellProps) {
  const tauriOs = isTauri() ? osType() : undefined;
  const isTauriMobile = tauriOs === 'android' || tauriOs === 'ios';
  const needsBottomSystemBar = tauriOs === 'android';
  const isBrowserMobile = !isTauri() && mobileOrTablet();
  const enabled = isTauriMobile || isBrowserMobile;
  const { safeAreaFill } = useSystemBarStyle();

  return (
    <>
      <div
        style={
          {
            '--sable-safe-area-top': enabled ? safeAreaTop : '0px',
            // Intentionally zero on iOS/web mobile. Room views own their
            // keyboard/home-indicator spacing separately, and reserving the
            // browser inset here reintroduced the persistent bottom gap.
            '--sable-safe-area-bottom': '0px',
            '--sable-safe-area-left': enabled ? safeAreaLeft : '0px',
            '--sable-safe-area-right': enabled ? safeAreaRight : '0px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minHeight: 0,
            flex: 1,
            // Paint the safe-area padding with the same surface color as the
            // active route. Room routes register a surface fill through the
            // shell context while nav/settings pages leave the default
            // background container color in place.
            backgroundColor: enabled ? (safeAreaFill ?? 'var(--sable-bg-container)') : undefined,
            paddingTop: enabled ? safeAreaTop : 0,
            paddingBottom: 0,
            paddingLeft: enabled ? safeAreaLeft : 0,
            paddingRight: enabled ? safeAreaRight : 0,
          } as CSSProperties
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minHeight: 0,
            flex: 1,
          }}
        >
          {children}
        </div>

        <div id="portalContainer" ref={onPortalContainerChange} />
      </div>

      {needsBottomSystemBar && <SystemBarStrip position="bottom" size={safeAreaBottom} />}
    </>
  );
}
