import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { useStore } from 'jotai';

import { ClientConfigLoader } from '$components/ClientConfigLoader';
import { AppShell } from '$components/app-shell';
import type { ClientConfig } from '$hooks/useClientConfig';
import { ClientConfigProvider } from '$hooks/useClientConfig';
import { setMatrixToBase } from '$plugins/matrix-to';
import { useScreenSize } from '$hooks/useScreenSize';
import { useCompositionEndTracking } from '$hooks/useComposingCheck';
import { bootstrapSettingsStore, primeRuntimeSettingsDefaults } from '$state/settings';
import { ErrorPage } from '$components/DefaultErrorPage';
import { ConfigConfigError, ConfigConfigLoading } from './ConfigConfig';
import { FeatureCheck } from './FeatureCheck';
import { createRouter } from './Router';

const queryClient = new QueryClient();

const renderAppErrorFallback: NonNullable<
  ComponentProps<typeof Sentry.ErrorBoundary>['fallback']
> = ({ error, eventId }) => (
  <ErrorPage
    error={error instanceof Error ? error : new Error(String(error))}
    eventId={eventId || undefined}
  />
);

const renderConfigLoading = () => <ConfigConfigLoading />;

const renderConfigError = (err: unknown, retry: () => void, ignore: () => void) => (
  <ConfigConfigError error={err} retry={retry} ignore={ignore} />
);

function SettingsStoreBootstrap({
  settingsDefaults,
  children,
}: {
  settingsDefaults: ClientConfig['settingsDefaults'];
  children: ReactNode;
}) {
  const store = useStore();
  const bootstrappedDefaultsRef = useRef<ClientConfig['settingsDefaults']>();

  useLayoutEffect(() => {
    if (bootstrappedDefaultsRef.current === settingsDefaults) return;
    bootstrapSettingsStore(store, settingsDefaults);
    bootstrappedDefaultsRef.current = settingsDefaults;
  }, [settingsDefaults, store]);

  return children;
}

function AppWithClientConfig({
  clientConfig,
  screenSize,
}: {
  clientConfig: ClientConfig;
  screenSize: ReturnType<typeof useScreenSize>;
}) {
  const bootstrappedDefaultsRef = useRef<ClientConfig['settingsDefaults']>();
  if (bootstrappedDefaultsRef.current !== clientConfig.settingsDefaults) {
    primeRuntimeSettingsDefaults(clientConfig.settingsDefaults);
    bootstrappedDefaultsRef.current = clientConfig.settingsDefaults;
  }

  const router = useMemo(() => createRouter(clientConfig, screenSize), [clientConfig, screenSize]);

  useEffect(() => {
    setMatrixToBase(clientConfig.matrixToBaseUrl);
  }, [clientConfig.matrixToBaseUrl]);

  return (
    <ClientConfigProvider value={clientConfig}>
      <SettingsStoreBootstrap settingsDefaults={clientConfig.settingsDefaults}>
        <RouterProvider router={router} />
      </SettingsStoreBootstrap>
    </ClientConfigProvider>
  );
}

function AppClientConfigLoader({ screenSize }: { screenSize: ReturnType<typeof useScreenSize> }) {
  return (
    <ClientConfigLoader fallback={renderConfigLoading} error={renderConfigError}>
      {(clientConfig) => (
        <AppWithClientConfig clientConfig={clientConfig} screenSize={screenSize} />
      )}
    </ClientConfigLoader>
  );
}

function useSafeAreaSentryContext() {
  useEffect(() => {
    // Measure env(safe-area-inset-*) at startup and attach to every Sentry event
    // so future safe-area colour reports (e.g. CHARM-6Z / #396) include the real
    // inset values and are easier to reproduce and triage.
    // Use one element per axis: setting conflicting positional properties
    // (e.g. top + bottom) on a single element can cause the secondary to
    // resolve to "auto" in some browsers, producing incorrect diagnostics.
    const measure = (prop: string, envVar: string): string => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;pointer-events:none;opacity:0;${prop}:${envVar};`;
      document.body.appendChild(el);
      const value = getComputedStyle(el).getPropertyValue(prop);
      document.body.removeChild(el);
      return value;
    };
    const top = measure('top', 'env(safe-area-inset-top,0px)');
    const bottom = measure('bottom', 'env(safe-area-inset-bottom,0px)');
    const left = measure('left', 'env(safe-area-inset-left,0px)');
    const right = measure('right', 'env(safe-area-inset-right,0px)');

    Sentry.setContext('safe_area_insets', { top, bottom, left, right });
    Sentry.setTag('safe_area_top', top);
  }, []);
}

function App() {
  const screenSize = useScreenSize();
  useCompositionEndTracking();
  useSafeAreaSentryContext();

  return (
    <Sentry.ErrorBoundary fallback={renderAppErrorFallback}>
      <AppShell screenSize={screenSize} queryClient={queryClient}>
        <FeatureCheck>
          <AppClientConfigLoader screenSize={screenSize} />
        </FeatureCheck>
      </AppShell>
    </Sentry.ErrorBoundary>
  );
}

export default App;
