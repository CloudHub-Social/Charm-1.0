import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { OverlayContainerProvider, PopOutContainerProvider, TooltipContainerProvider } from 'folds';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';

import { ClientConfigLoader } from '$components/ClientConfigLoader';
import type { ClientConfig } from '$hooks/useClientConfig';
import { ClientConfigProvider } from '$hooks/useClientConfig';
import { setMatrixToBase } from '$plugins/matrix-to';
import type { ScreenSize } from '$hooks/useScreenSize';
import { ScreenSizeProvider, useScreenSize } from '$hooks/useScreenSize';
import { useCompositionEndTracking } from '$hooks/useComposingCheck';
import { ErrorPage } from '$components/DefaultErrorPage';
import { ConfigConfigError, ConfigConfigLoading } from './ConfigConfig';
import { FeatureCheck } from './FeatureCheck';
import { createRouter } from './Router';
import { isReactQueryDevtoolsEnabled } from './reactQueryDevtoolsGate';
import { bootstrapSettingsStore } from '$state/settings';

const queryClient = new QueryClient();
const ReactQueryDevtools = lazy(async () => {
  const { ReactQueryDevtools: Devtools } = await import('@tanstack/react-query-devtools');

  return { default: Devtools };
});

type BootstrappedAppShellProps = {
  clientConfig: ClientConfig;
  screenSize: ScreenSize;
};

function BootstrappedAppShell({ clientConfig, screenSize }: BootstrappedAppShellProps) {
  const jotaiStoreRef = useRef<ReturnType<typeof createStore>>();
  if (!jotaiStoreRef.current) {
    jotaiStoreRef.current = createStore();
  }
  bootstrapSettingsStore(jotaiStoreRef.current, clientConfig.settingsDefaults);
  const reactQueryDevtoolsEnabled = isReactQueryDevtoolsEnabled();

  return (
    <ClientConfigProvider value={clientConfig}>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={jotaiStoreRef.current}>
          <RouterProvider router={createRouter(clientConfig, screenSize)} />
        </JotaiProvider>
        {reactQueryDevtoolsEnabled && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </QueryClientProvider>
    </ClientConfigProvider>
  );
}

function renderSentryErrorFallback({ error, eventId }: { error: unknown; eventId: string | null }) {
  return (
    <ErrorPage
      error={error instanceof Error ? error : new Error(String(error))}
      eventId={eventId || undefined}
    />
  );
}

function appConfigFallback() {
  return <ConfigConfigLoading />;
}

function appConfigError(err: unknown, retry: () => void, ignore: () => void) {
  return <ConfigConfigError error={err} retry={retry} ignore={ignore} />;
}

function AppConfigLoaded({ clientConfig, screenSize }: BootstrappedAppShellProps) {
  setMatrixToBase(clientConfig.matrixToBaseUrl);
  return <BootstrappedAppShell clientConfig={clientConfig} screenSize={screenSize} />;
}

function useSafeAreaSentryContext() {
  useEffect(() => {
    // Measure env(safe-area-inset-*) values via a temporary DOM element so we
    // can include them as Sentry context on every event — helps triage future
    // safe-area colour issues (see CHARM-6Z / GitHub #396).
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;pointer-events:none;opacity:0;' +
      'top:env(safe-area-inset-top,0px);' +
      'bottom:env(safe-area-inset-bottom,0px);' +
      'left:env(safe-area-inset-left,0px);' +
      'right:env(safe-area-inset-right,0px);';
    document.body.appendChild(probe);
    const { top, bottom, left, right } = getComputedStyle(probe);
    document.body.removeChild(probe);

    Sentry.setContext('safe_area_insets', { top, bottom, left, right });
    Sentry.setTag('safe_area_top', top);
  }, []);
}

function App() {
  const screenSize = useScreenSize();
  useCompositionEndTracking();
  useSafeAreaSentryContext();
  const portalContainer = document.getElementById('portalContainer') ?? undefined;

  const renderAppConfig = useCallback(
    (clientConfig: ClientConfig) => (
      <AppConfigLoaded clientConfig={clientConfig} screenSize={screenSize} />
    ),
    [screenSize]
  );

  return (
    <Sentry.ErrorBoundary fallback={renderSentryErrorFallback}>
      <TooltipContainerProvider value={portalContainer}>
        <PopOutContainerProvider value={portalContainer}>
          <OverlayContainerProvider value={portalContainer}>
            <ScreenSizeProvider value={screenSize}>
              <FeatureCheck>
                <ClientConfigLoader fallback={appConfigFallback} error={appConfigError}>
                  {renderAppConfig}
                </ClientConfigLoader>
              </FeatureCheck>
            </ScreenSizeProvider>
          </OverlayContainerProvider>
        </PopOutContainerProvider>
      </TooltipContainerProvider>
    </Sentry.ErrorBoundary>
  );
}

export default App;
