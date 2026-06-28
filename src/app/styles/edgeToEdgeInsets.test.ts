import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../../..');

const readWorkspaceFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('android edge-to-edge inset contract', () => {
  it('wires the mobile edge-to-edge plugin through Cargo and Tauri setup', () => {
    const cargoToml = readWorkspaceFile('src-tauri/Cargo.toml');
    const tauriLib = readWorkspaceFile('src-tauri/src/lib.rs');

    expect(cargoToml).toContain(
      'tauri-plugin-edge-to-edge = { git = "https://github.com/SableClient/tauri-plugin-edge-to-edge.git", rev = "33c6116c27be28c06df5a9d02231ecc5fdeb93c5" }'
    );
    expect(tauriLib).toContain('builder = builder.plugin(tauri_plugin_edge_to_edge::init());');
  });

  it('keeps MainActivity out of the inset injection path', () => {
    const mainActivity = readWorkspaceFile(
      'src-tauri/gen/android/app/src/main/java/moe/sable/client/MainActivity.kt'
    );

    expect(mainActivity).toContain('enableEdgeToEdge()');
    expect(mainActivity).not.toContain('s.setProperty(');
    expect(mainActivity).not.toContain('setOnApplyWindowInsetsListener');
    expect(mainActivity).not.toContain('webView.webViewClient');
  });

  it('moves portal ownership into the app shell', () => {
    const indexHtml = readWorkspaceFile('index.html');
    const appTsx = readWorkspaceFile('src/app/pages/App.tsx');
    const appShell = readWorkspaceFile('src/app/components/app-shell/AppShell.tsx');
    const systemBarShell = readWorkspaceFile('src/app/components/app-shell/SystemBarShell.tsx');

    expect(indexHtml).not.toContain('id="portalContainer"');
    expect(appTsx).toContain('<AppShell screenSize={screenSize} queryClient={queryClient}>');
    expect(appShell).toContain('const [portalContainer, setPortalContainer] = useState');
    expect(appShell).toContain('<SystemBarShell onPortalContainerChange={setPortalContainer}>');
    expect(systemBarShell).toContain('ref={onPortalContainerChange}');
  });

  it('uses the App shell as the only safe-area owner', () => {
    const appShell = readWorkspaceFile('src/app/components/app-shell/AppShell.tsx');
    const generalOverrides = readWorkspaceFile('src/app/styles/overrides/General.css.ts');
    const indexHtml = readWorkspaceFile('index.html');
    const indexCss = readWorkspaceFile('src/index.css');
    const systemBarShell = readWorkspaceFile('src/app/components/app-shell/SystemBarShell.tsx');
    const room = readWorkspaceFile('src/app/features/room/Room.tsx');
    const systemBarStyle = readWorkspaceFile('src/app/components/app-shell/useSystemBarStyle.tsx');
    const mobileCapability = readWorkspaceFile('src-tauri/capabilities/mobile.json');

    // viewport-fit=cover is required for env(safe-area-inset-*) to work in iOS
    // Safari and PWAs. Android/Tauri uses the edge-to-edge plugin instead, but
    // viewport-fit=cover has no side-effect on Android since the CSS variables
    // are gated on !isTauri().
    expect(indexHtml).toContain('viewport-fit=cover');
    expect(indexHtml).not.toContain('interactive-widget=');
    expect(appShell).toContain('const contentHeight = useCustomWindowsTitleBar');
    expect(appShell).toContain("height: '100%'");
    expect(appShell).toContain('height: contentHeight');
    expect(appShell).toContain('<ScreenSizeProvider value={screenSize}>');
    expect(appShell).toContain('<SystemBarStyleProvider>');
    expect(indexCss).toContain('height: var(--sable-visible-height, 100vh)');
    expect(indexCss).not.toContain('height: var(--sable-visible-height, 100%)');
    expect(indexCss).not.toContain('height: var(--sable-visible-height, 100dvh)');
    expect(generalOverrides).toContain("backgroundColor: 'var(--sable-bg-container)'");
    expect(systemBarShell).toContain('var(--safe-area-inset-top, env(safe-area-inset-top, 0px))');
    // Bottom safe area is zeroed out: iOS home-indicator padding must not push
    // content up off the bottom of the screen.
    expect(systemBarShell).toContain("'--sable-safe-area-bottom': '0px'");
    expect(systemBarShell).toContain('backgroundColor: enabled');
    expect(systemBarShell).toContain("safeAreaFill ?? 'var(--sable-bg-container)'");
    expect(systemBarShell).toContain('paddingBottom: 0');
    expect(systemBarShell).toContain("removeProperty('--sable-visible-height')");
    expect(systemBarShell).toContain("removeProperty('--sable-safe-bottom')");
    expect(systemBarShell).toContain('const keyboardVarsApplied =');
    expect(systemBarShell).toContain(
      "document.documentElement.style.getPropertyValue('--sable-visible-height') !== ''"
    );
    expect(systemBarStyle).toContain(
      'registerSafeAreaFill: (owner: symbol, fill: string | undefined) => void;'
    );
    expect(systemBarStyle).toContain(
      'const registerSafeAreaFill = useCallback((nextOwner: symbol, fill: string | undefined) => {'
    );
    expect(systemBarStyle).toContain(
      'const unregisterSafeAreaFill = useCallback((nextOwner: symbol) => {'
    );
    expect(systemBarStyle).toContain(
      'current.owner === nextOwner ? { owner: null, safeAreaFill: undefined } : current'
    );
    expect(systemBarStyle).toContain(
      "const ownerRef = useRef(Symbol('system-bar-safe-area-fill'))"
    );
    expect(room).toContain(
      'const isSinglePaneRoomLayout = screenSize === ScreenSize.Mobile || isPhoneLayoutDevice()'
    );
    expect(room).toContain("isSinglePaneRoomLayout ? 'var(--sable-surface-container)' : undefined");
    expect(systemBarShell).toContain("const needsBottomSystemBar = tauriOs === 'android'");
    expect(systemBarShell).toContain('var(--sable-bg-container-line)');
    expect(systemBarShell).toContain("borderTop: '1px solid var(--sable-bg-container-line)'");
    expect(mobileCapability).toContain('"edge-to-edge:default"');
  });

  it('removes the scattered safe-area css consumers', () => {
    const indexCss = readWorkspaceFile('src/index.css');
    const pageStyles = readWorkspaceFile('src/app/components/page/style.css.ts');
    const sidebarStyles = readWorkspaceFile('src/app/components/sidebar/Sidebar.css.ts');
    const roomView = readWorkspaceFile('src/app/features/room/RoomView.tsx');
    const roomViewTypingStyles = readWorkspaceFile('src/app/features/room/RoomViewTyping.css.ts');
    const threadDrawerStyles = readWorkspaceFile('src/app/features/room/ThreadDrawer.css.ts');

    expect(indexCss).not.toContain('--sable-inset-top');
    expect(indexCss).not.toContain('--sable-inset-bottom');
    expect(pageStyles).not.toContain('--sable-inset-');
    expect(pageStyles).toContain('var(--sable-safe-area-bottom, 0px)');
    expect(sidebarStyles).not.toContain('--sable-inset-');
    expect(roomView).toContain('paddingBottom: 0');
    expect(roomViewTypingStyles).not.toContain('--sable-inset-');
    expect(threadDrawerStyles).not.toContain('--sable-inset-');
  });

  it('keeps web banners viewport-anchored', () => {
    const notificationBannerStyles = readWorkspaceFile(
      'src/app/components/notification-banner/NotificationBanner.css.ts'
    );
    const telemetryBannerStyles = readWorkspaceFile(
      'src/app/components/telemetry-consent/TelemetryConsentBanner.css.ts'
    );

    expect(notificationBannerStyles).toContain("position: 'fixed'");
    expect(notificationBannerStyles).toContain("top: 'env(safe-area-inset-top, 0)'");
    expect(telemetryBannerStyles).toContain("position: 'fixed'");
    expect(telemetryBannerStyles).toContain("bottom: 'env(safe-area-inset-bottom, 0)'");
  });

  it('keeps splash and account-switcher controls inside the mobile viewport', () => {
    const clientRoot = readWorkspaceFile('src/app/pages/client/ClientRoot.tsx');
    const accountSwitcher = readWorkspaceFile(
      'src/app/pages/client/sidebar/AccountSwitcherTab.tsx'
    );

    expect(clientRoot).toMatch(
      /const safeAreaTopInset\s*=\s*["']var\(--sable-safe-area-top, env\(safe-area-inset-top, 0px\)\)["']/
    );
    expect(clientRoot).toMatch(
      /const safeAreaRightInset\s*=\s*["']var\(--sable-safe-area-right, env\(safe-area-inset-right, 0px\)\)["']/
    );
    expect(clientRoot).toContain('right: `calc(${safeAreaRightInset} + ${config.space.S100})`');
    expect(accountSwitcher).toContain('const getAccountSwitcherMenuMaxHeight = (');
    expect(accountSwitcher).toContain('...sectionMenuContentStyle');
    expect(accountSwitcher).toContain('maxHeight: sectionMenuMaxHeight');
    expect(accountSwitcher).toContain('flex: 1');
    expect(accountSwitcher).toContain('minHeight: 0');
    expect(accountSwitcher).toContain('const availableAboveTrigger = Math.max(');
    expect(accountSwitcher).toContain('menuAnchor.y - mobileMenuViewportPadding');
    expect(accountSwitcher).toMatch(/WebkitOverflowScrolling:\s*["']touch["']/);
    expect(accountSwitcher).toMatch(/<\/Scroll>\s*<Box[\s\S]*App Settings/);
  });
});
