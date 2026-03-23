import './instrument';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource-variable/nunito';
import '@fontsource-variable/nunito/wght-italic.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/space-mono/400-italic.css';
import '@fontsource/space-mono/700-italic.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';
import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';
import './app/i18n';

import './index.css';
import './app/styles/themes.css';
import './app/styles/overrides/General.css';
import './app/styles/overrides/Privacy.css';
import { pushSessionToSW } from './sw-session';
import {
  getFallbackSession,
  MATRIX_SESSIONS_KEY,
  Sessions,
  ACTIVE_SESSION_KEY,
} from './app/state/sessions';
import { createLogger } from './app/utils/debug';
import { getLocalStorageItem } from './app/state/utils/atomWithLocalStorage';
import { consumeReloadReason, markReloadReason } from './app/utils/reloadDiag';

enableMapSet();
const log = createLogger('index');

// If the previous page was forcibly reloaded, show why in the console so we can
// diagnose crashes without DevTools staying open across the reload.
const _prevReload = consumeReloadReason();
if (_prevReload) {
  // eslint-disable-next-line no-console
  console.warn(
    `[Sable] Previous page reloaded — reason: ${_prevReload.reason} at ${_prevReload.time}`
  );
}

document.body.classList.add(configClass, varsClass);

if ('serviceWorker' in navigator) {
  const isProduction = import.meta.env.MODE === 'production';
  const swUrl = isProduction
    ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
    : `/dev-sw.js?dev-sw`;

  const swRegisterOptions: RegistrationOptions = {};
  if (!isProduction) {
    swRegisterOptions.type = 'module';
  }

  // Reload when a *new* SW version (code update) takes control so the page
  // picks up fresh precached assets.  Only fire once, and crucially only when
  // a new SW was actually installing — NOT when the same SW is restarted after
  // being killed (e.g. Vivaldi PWA aggressively kills the SW on blur; that
  // restart also fires controllerchange but must not trigger a reload loop).
  let swRefreshing = false;
  let swUpdatePending = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    // Always log so we can diagnose unexpected controllerchange events.
    log.warn('controllerchange fired — swUpdatePending:', swUpdatePending);
    if (!swUpdatePending) return; // SW restart, not a code update — skip reload
    swRefreshing = true;
    markReloadReason('controllerchange (SW code update)');
    window.location.reload();
  });

  const sendSessionToSW = () => {
    // Use the active session from the new multi-session store, fall back to legacy
    const sessions = getLocalStorageItem<Sessions>(MATRIX_SESSIONS_KEY, []);
    const activeId = getLocalStorageItem<string | undefined>(ACTIVE_SESSION_KEY, undefined);
    const active =
      sessions.find((s) => s.userId === activeId) ?? sessions[0] ?? getFallbackSession();
    pushSessionToSW(active?.baseUrl, active?.accessToken, active?.userId);
  };

  navigator.serviceWorker
    .register(swUrl, swRegisterOptions)
    .then((registration) => {
      // If a new SW version is already installing when we register, mark it as
      // pending so the controllerchange handler knows to reload.
      //
      // IMPORTANT: only do this when there is already an active SW (i.e. this
      // is a code *update*, not a first install).  On a first install
      // registration.installing is also non-null, but the controllerchange
      // that follows clients.claim() must NOT trigger a reload — Vivaldi PWA
      // handles window.location.reload() by closing+relaunching the window,
      // which looks like a crash to the user.
      if (registration.active && (registration.installing || registration.waiting)) {
        swUpdatePending = true;
      }
      registration.addEventListener('updatefound', () => {
        swUpdatePending = true;
        // Reset the flag if the installation is aborted so a spurious
        // controllerchange from a later restart does not trigger a reload.
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'redundant') swUpdatePending = false;
        });
      });
      sendSessionToSW();
    })
    .catch((err) => {
      log.warn('SW registration failed:', err);
    });
  navigator.serviceWorker.ready.then(sendSessionToSW).catch((err) => {
    log.warn('SW ready failed:', err);
  });

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { data } = ev;
    if (!data || typeof data !== 'object') return;
    const { type } = data as { type?: unknown };

    if (type === 'requestSession') {
      sendSessionToSW();
    }

    if (data.type === 'token' && data.id) {
      const token = localStorage.getItem('cinny_access_token') ?? undefined;
      ev.source?.postMessage({
        replyTo: data.id,
        payload: token,
      });
    } else if (data.type === 'openRoom' && data.id) {
      /* Example:
      event.source.postMessage({
        replyTo: event.data.id,
        payload: success?,
      });
      */
    }
  });
}

const injectIOSMetaTags = () => {
  const metaTags = [
    { name: 'theme-color', content: '#0C0B0F' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
  ];

  metaTags.forEach((tag) => {
    let element = document.querySelector(`meta[name="${tag.name}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute('name', tag.name);
      document.head.appendChild(element);
    }
    element.setAttribute('content', tag.content);
  });
};

injectIOSMetaTags();

// Handle chunk loading failures with automatic retry
const CHUNK_RETRY_KEY = 'cinny_chunk_retry_count';
const MAX_CHUNK_RETRIES = 2;

window.addEventListener('error', (event) => {
  // Check if this is a chunk loading error
  const isChunkLoadError =
    event.message?.includes('dynamically imported module') ||
    event.error?.name === 'ChunkLoadError';

  if (isChunkLoadError) {
    const retryCount = parseInt(sessionStorage.getItem(CHUNK_RETRY_KEY) ?? '0', 10);

    if (retryCount < MAX_CHUNK_RETRIES) {
      // Increment retry count and reload
      sessionStorage.setItem(CHUNK_RETRY_KEY, String(retryCount + 1));
      log.warn(`Chunk load failed, reloading (attempt ${retryCount + 1}/${MAX_CHUNK_RETRIES})`);
      markReloadReason(`chunk-load-retry (attempt ${retryCount + 1}): ${event.message ?? event.error?.name}`);
      window.location.reload();

      // Prevent default error handling since we're reloading
      event.preventDefault();
    } else {
      // Max retries exceeded, clear counter and let error bubble up
      sessionStorage.removeItem(CHUNK_RETRY_KEY);
      log.error('Chunk load failed after max retries, showing error');
    }
  }
});

// Clear chunk retry counter on successful page load
window.addEventListener('load', () => {
  sessionStorage.removeItem(CHUNK_RETRY_KEY);
});

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    throw new Error('Root container element not found!');
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
};

mountApp();
