import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncStatus } from '$hooks/useAsyncCallback';
import { PdfViewer } from './PdfViewer';

// PdfViewer lazy-loads pdfjs-dist and drives page rendering through
// usePdfJSLoader/usePdfDocumentLoader. Mock both so the "jump to page" footer
// (which only renders once docState is AsyncStatus.Success) is reachable
// without a real PDF or worker.
vi.mock('$plugins/pdfjs-dist', () => ({
  usePdfJSLoader: () => [{ status: AsyncStatus.Success, data: {} }, vi.fn<() => void>()],
  usePdfDocumentLoader: () => [
    { status: AsyncStatus.Success, data: { numPages: 5, getPage: vi.fn<() => void>() } },
    vi.fn<() => void>(),
  ],
  createPage: vi.fn<() => Promise<HTMLCanvasElement>>(() =>
    Promise.resolve(document.createElement('canvas'))
  ),
}));

// jsdom has no ResizeObserver; useImageGestures observes the viewer's
// container via useElementSizeObserver. A no-op stub is enough here since
// none of these tests depend on resize behavior.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom (unlike real browsers) does not implement HTMLFormElement's named
// getter for its controls (form.jumpInput), which `handleJumpSubmit` in
// PdfViewer.tsx relies on to read the "Jump To Page" input. Polyfill just
// enough of it - by name, from `elements` (which jsdom does support) - so
// the submit path under test exercises the real production code instead of
// a stand-in for it.
if (!('jumpInput' in HTMLFormElement.prototype)) {
  Object.defineProperty(HTMLFormElement.prototype, 'jumpInput', {
    configurable: true,
    get(this: HTMLFormElement) {
      return this.elements.namedItem('jumpInput');
    },
  });
}

const renderViewer = () => {
  const requestClose = vi.fn<() => void>();
  const utils = render(
    <div>
      <button type="button">Outside the viewer</button>
      <PdfViewer name="test.pdf" src="blob:test" requestClose={requestClose} />
    </div>
  );
  return { requestClose, ...utils };
};

const openJumpMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const jumpChip = screen.getByText('1/5');
  await user.click(jumpChip);
  await waitFor(() => {
    expect(screen.getByLabelText('Page Number')).toBeInTheDocument();
  });
};

describe('PdfViewer nested focus-trap click-outside', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    vi.clearAllMocks();
  });

  it('closes only the popout when the outside click still lands inside the viewer', async () => {
    const user = userEvent.setup();
    const { requestClose } = renderViewer();

    await openJumpMenu(user);

    // Click on something inside the viewer but outside the popout - e.g. the
    // "Previous" footer chip. This must dismiss only the jump-to-page popout;
    // the viewer itself must stay open (no requestClose call).
    const previousChip = screen.getByText('Previous');
    await user.click(previousChip);

    await waitFor(() => {
      expect(screen.queryByLabelText('Page Number')).not.toBeInTheDocument();
    });
    expect(requestClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes the whole viewer on a single click fully outside both the popout and the viewer', async () => {
    const user = userEvent.setup();
    const { requestClose } = renderViewer();

    await openJumpMenu(user);

    // A single click on something outside the viewer entirely must close
    // both the popout and the viewer in that one click - not require a
    // second click after the popout closes.
    const outsideButton = screen.getByText('Outside the viewer');
    await user.click(outsideButton);

    expect(requestClose).toHaveBeenCalledTimes(1);
  });

  it('does not request close when the popout is dismissed via Escape', async () => {
    const user = userEvent.setup();
    const { requestClose } = renderViewer();

    await openJumpMenu(user);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByLabelText('Page Number')).not.toBeInTheDocument();
    });
    expect(requestClose).not.toHaveBeenCalled();
  });

  it(
    'closes the popout via Escape even when its own Page Number input has focus, ' +
      'without closing the outer viewer (comment 3515215016)',
    async () => {
      const user = userEvent.setup();
      const { requestClose } = renderViewer();

      await openJumpMenu(user);

      // Explicitly focus the popout's own input. The shared `stopPropagation`
      // keyboard helper (used elsewhere as `escapeDeactivates`) declines to
      // act when the active element is editable, which - if reused here -
      // would leave Escape unable to close this popout while its input has
      // focus. This popout must use its own always-deactivate handler
      // instead, so Escape still works from inside the input.
      const input = screen.getByLabelText('Page Number');
      await user.click(input);
      expect(document.activeElement).toBe(input);

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByLabelText('Page Number')).not.toBeInTheDocument();
      });
      // Only the popout should close - the outer viewer trap's requestClose
      // must NOT be invoked as a side effect of this Escape press.
      expect(requestClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }
  );

  it('does not request close when the popout is dismissed via form submit', async () => {
    const user = userEvent.setup();
    const { requestClose } = renderViewer();

    await openJumpMenu(user);

    await user.click(screen.getByRole('button', { name: 'Jump To Page' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Page Number')).not.toBeInTheDocument();
    });
    expect(requestClose).not.toHaveBeenCalled();
  });

  it('does not leak a stale outside mousedown into a later Escape-driven close', async () => {
    const user = userEvent.setup();
    const { requestClose } = renderViewer();

    await openJumpMenu(user);

    // Open and dismiss the popout a second time via Escape, with no new
    // mousedown in between. Without the reset in `handleOpenJump`, the
    // second `onDeactivate` would still be holding whatever mousedown
    // target was last recorded from the very first popout open above (the
    // "1/5" chip, inside the viewer) - which happens to be safe here, but
    // only by the guard resetting it, not by coincidence: this exercises
    // that the ref is actually cleared on every open, not just the first.
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByLabelText('Page Number')).not.toBeInTheDocument();
    });
    expect(requestClose).not.toHaveBeenCalled();

    await openJumpMenu(user);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByLabelText('Page Number')).not.toBeInTheDocument();
    });
    expect(requestClose).not.toHaveBeenCalled();
  });
});
