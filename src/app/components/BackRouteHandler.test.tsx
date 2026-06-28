import { describe, expect, it } from 'vitest';
import { Provider } from 'jotai';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BackRouteHandler } from './BackRouteHandler';

function RoomRoute() {
  const location = useLocation();

  return (
    <BackRouteHandler>
      {(onBack) => (
        <>
          <button type="button" onClick={onBack}>
            Back
          </button>
          <div data-testid="location">{`${location.pathname}${location.search}`}</div>
        </>
      )}
    </BackRouteHandler>
  );
}

describe('BackRouteHandler', () => {
  it('waits for notification deeplink cleanup to land before navigating back', async () => {
    window.history.replaceState({ idx: 1 }, '');

    render(
      <Provider>
        <MemoryRouter
          initialEntries={[
            '/inbox/',
            '/home/%21room%3Aexample/%24event%3Aexample?jumpMode=notification_live&via=push',
          ]}
          initialIndex={1}
        >
          <Routes>
            <Route path="/inbox/" element={<div data-testid="location">/inbox/</div>} />
            <Route path="/home/:roomIdOrAlias/:eventId?" element={<RoomRoute />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/inbox/');
    });
  });
});
