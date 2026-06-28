import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { activeSessionIdAtom, pendingNotificationAtom } from '$state/sessions';
import { HandleNotificationClick } from './ClientNonUIFeatures';

const originalServiceWorker = Object.getOwnPropertyDescriptor(window.navigator, 'serviceWorker');
const originalServiceWorkerCtor = globalThis.ServiceWorker;

function installServiceWorkerMock() {
  Object.defineProperty(globalThis, 'ServiceWorker', {
    configurable: true,
    value: class ServiceWorkerMock {
      postMessage(): void {}
    },
  });

  const listeners = new Set<(event: MessageEvent) => void>();

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: null,
      ready: Promise.resolve({
        active: null,
        waiting: null,
        installing: null,
      }),
      addEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'message' && typeof handler === 'function') {
          listeners.add(handler as (event: MessageEvent) => void);
        }
      },
      removeEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
        if (type === 'message' && typeof handler === 'function') {
          listeners.delete(handler as (event: MessageEvent) => void);
        }
      },
    },
  });

  return {
    emit: (data: unknown) => {
      listeners.forEach((listener) => listener(new MessageEvent('message', { data })));
    },
  };
}

function Probe() {
  const location = useLocation();
  const activeSessionId = useAtomValue(activeSessionIdAtom);
  const pendingNotification = useAtomValue(pendingNotificationAtom);

  return (
    <pre data-testid="probe">
      {JSON.stringify({
        location: `${location.pathname}${location.search}`,
        activeSessionId,
        pendingNotification,
      })}
    </pre>
  );
}

describe('HandleNotificationClick', () => {
  afterEach(() => {
    cleanup();

    if (originalServiceWorker) {
      Object.defineProperty(window.navigator, 'serviceWorker', originalServiceWorker);
      return;
    }

    // @ts-expect-error test cleanup for optional browser API
    delete window.navigator.serviceWorker;
  });

  afterEach(() => {
    if (originalServiceWorkerCtor) {
      Object.defineProperty(globalThis, 'ServiceWorker', {
        configurable: true,
        value: originalServiceWorkerCtor,
      });
      return;
    }

    // @ts-expect-error test cleanup for optional browser API
    delete globalThis.ServiceWorker;
  });

  it('queues room restore state without routing through the transient /to path', async () => {
    const serviceWorker = installServiceWorkerMock();

    const { getByTestId } = render(
      <Provider>
        <MemoryRouter initialEntries={['/home/%21current%3Aexample']}>
          <HandleNotificationClick />
          <Routes>
            <Route path="*" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    act(() => {
      serviceWorker.emit({
        type: 'notificationClick',
        clickId: 'notification-click-123',
        userId: '@alice:example',
        roomId: '!room:example',
        eventId: '$event123',
      });
    });

    await waitFor(() => {
      const payload = JSON.parse(getByTestId('probe').textContent ?? '{}') as {
        location?: string;
        activeSessionId?: string;
        pendingNotification?: {
          roomId?: string;
          eventId?: string;
          jumpMode?: string;
          source?: string;
          swClickId?: string;
          targetSessionId?: string;
        };
      };

      expect(payload.location).toBe('/home/%21current%3Aexample');
      expect(payload.activeSessionId).toBe('@alice:example');
      expect(payload.pendingNotification).toMatchObject({
        roomId: '!room:example',
        eventId: '$event123',
        jumpMode: 'notification_live',
        source: 'service_worker_click',
        swClickId: 'notification-click-123',
        targetSessionId: '@alice:example',
      });
    });
  });
});
