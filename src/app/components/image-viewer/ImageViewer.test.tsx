/* oxlint-disable vitest/require-mock-type-parameters */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FileSaver from 'file-saver';
import { ImageViewer } from './ImageViewer';

const downloadMedia = vi.fn();

vi.mock('$hooks/useImageGestures', () => ({
  useImageGestures: () => ({
    transforms: { zoom: 1, pan: { x: 0, y: 0 } },
    cursor: 'grab',
    handleWheel: vi.fn(),
    onPointerDown: vi.fn(),
    resetTransforms: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setZoom: vi.fn(),
    fitRatio: 1,
    imageRef: { current: null },
    containerRef: { current: null },
    handleImageLoad: vi.fn(),
    enableResizeWithWindow: vi.fn(),
  }),
}));

vi.mock('$utils/matrix', () => ({
  downloadMedia: (...args: unknown[]) => downloadMedia(...args),
}));

vi.mock('file-saver', () => ({
  default: {
    saveAs: vi.fn(),
  },
}));

describe('ImageViewer', () => {
  it('downloads media without passing a media token argument', async () => {
    downloadMedia.mockResolvedValue(new Blob(['image']));

    render(
      <ImageViewer alt="kitten.png" src="https://example.org/kitten.png" requestClose={vi.fn()} />
    );

    fireEvent.click(screen.getByText('Download'));

    await waitFor(() => {
      expect(downloadMedia).toHaveBeenCalledWith('https://example.org/kitten.png');
    });
    expect(FileSaver.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'kitten.png');
  });

  // Regression test for #513: the close/back button used to render with no
  // accessible name at all (aria-label: null, title: "", text: ""), so a
  // screen reader announced it only as "button". Assert it's findable by
  // role+name specifically, the same way assistive tech locates it — a bare
  // aria-label attribute check would pass even if the accessible name were
  // wrong or duplicated elsewhere.
  //
  // Labeled "Close" (not "Back"): this button calls requestClose, which
  // dismisses the modal overlay (setViewer(false) / setViewAvatar(undefined)
  // / setBannerViewerOpen(false) at its call sites) rather than performing
  // navigation, so "Close" is the semantically correct action name.
  it('exposes the close button with an accessible role and name', () => {
    render(
      <ImageViewer alt="kitten.png" src="https://example.org/kitten.png" requestClose={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
