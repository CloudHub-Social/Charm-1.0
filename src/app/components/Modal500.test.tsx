import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenSize, ScreenSizeProvider } from '$hooks/useScreenSize';
import { Modal500 } from './Modal500';

describe('Modal500', () => {
  it('does not throw when rendered without tabbable children', () => {
    expect(() =>
      render(
        <ScreenSizeProvider value={ScreenSize.Desktop}>
          <Modal500 requestClose={vi.fn<() => void>()} ariaLabel="Test modal">
            <div>Empty modal content</div>
          </Modal500>
        </ScreenSizeProvider>
      )
    ).not.toThrow();
  });

  it('exposes the provided ariaLabel on the dialog element', () => {
    const { getByRole } = render(
      <ScreenSizeProvider value={ScreenSize.Desktop}>
        <Modal500 requestClose={vi.fn<() => void>()} ariaLabel="Room Settings">
          <div>Content</div>
        </Modal500>
      </ScreenSizeProvider>
    );

    expect(getByRole('dialog', { name: 'Room Settings' })).toBeTruthy();
  });

  it('exposes the provided ariaLabelledBy on the dialog element', () => {
    const { getByRole } = render(
      <ScreenSizeProvider value={ScreenSize.Desktop}>
        <Modal500 requestClose={vi.fn<() => void>()} ariaLabelledBy="modal-heading">
          <h2 id="modal-heading">Heading text</h2>
        </Modal500>
      </ScreenSizeProvider>
    );

    expect(getByRole('dialog', { name: 'Heading text' })).toBeTruthy();
  });
});
