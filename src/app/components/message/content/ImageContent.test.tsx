import { render, screen, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatrixClientProvider } from '$hooks/useMatrixClient';
import { ClientConfigProvider } from '$hooks/useClientConfig';
import { ImageContent } from './ImageContent';

const downloadMedia = vi.fn<(src: string, options?: unknown) => Promise<Blob>>();
const getMediaUrl =
  vi.fn<
    (
      mx: unknown,
      mxcUrl: string,
      useAuthentication: boolean,
      width?: number,
      height?: number,
      resizeMethod?: string,
      allowDirectLinks?: boolean
    ) => string | undefined
  >();
const { hasControllingServiceWorker } = vi.hoisted(() => ({
  hasControllingServiceWorker: vi.fn<() => boolean>(() => false),
}));

vi.mock('$hooks/useMediaAuthentication', () => ({
  useMediaAuthentication: () => true,
}));

vi.mock('$hooks/useMediaUrlCacheContext', () => ({
  useMediaUrlCacheContext: () => ({
    get: (
      mx: unknown,
      mxcUrl: string,
      useAuthentication: boolean,
      width?: number,
      height?: number,
      resizeMethod?: string,
      allowDirectLinks?: boolean
    ) => getMediaUrl(mx, mxcUrl, useAuthentication, width, height, resizeMethod, allowDirectLinks),
    getBlob: vi.fn<(url: string, encrypted: boolean, cacheKey?: string) => string | undefined>(),
    setBlob: vi.fn<(url: string, encrypted: boolean, blobUrl: string, cacheKey?: string) => void>(),
  }),
}));

vi.mock('$hooks/useMediaMetadata', () => ({
  useMediaMetadata: () => ({
    width: 320,
    height: 180,
  }),
}));

vi.mock('$utils/matrix', () => ({
  downloadMedia: (src: string, options?: unknown) => downloadMedia(src, options),
  downloadEncryptedMedia:
    vi.fn<
      (
        src: string,
        decryptContent: (buf: ArrayBuffer) => Promise<Blob | null>,
        accessToken?: string | null
      ) => Promise<Blob>
    >(),
  decryptFileSafe:
    vi.fn<
      (
        encBuf: ArrayBuffer,
        mimeType: string,
        encInfo: unknown,
        context?: { mediaUrl?: string }
      ) => Promise<Blob | null>
    >(),
}));

vi.mock('$hooks/useBlobCache', () => ({
  getDecryptedBlob: vi.fn<(url: string) => Promise<Blob | undefined>>(),
  storeDecryptedBlob: vi.fn<(url: string, blob: Blob) => Promise<void>>(),
}));

vi.mock('$utils/mediaMetadata', () => ({
  storeMediaMetadataForBlob:
    vi.fn<
      (
        cacheKey: string,
        blob: Blob,
        mediaKind: 'image' | 'video' | 'audio',
        options?: unknown
      ) => Promise<void>
    >(),
}));

vi.mock('$hooks/useFavoriteGifs', () => ({
  useFavoriteGifs: () => ({ gifs: [] }),
}));

vi.mock('$utils/platform', () => ({
  hasControllingServiceWorker,
}));

const renderWithProviders = (url: string, proxyUrl = 'gifs.example.org') =>
  render(
    <JotaiProvider>
      <MatrixClientProvider value={{ getAccessToken: () => null } as never}>
        <ClientConfigProvider value={{ gifs: { proxyUrl, klipyApiKey: 'test-key' } }}>
          <ImageContent
            body="Chatty Cat"
            mimeType="image/gif"
            url={url}
            autoPlay
            renderViewer={() => null}
            renderImage={(props) => (
              <img data-testid="rendered-image" alt={props.alt} src={props.src} />
            )}
          />
        </ClientConfigProvider>
      </MatrixClientProvider>
    </JotaiProvider>
  );

describe('ImageContent', () => {
  beforeEach(() => {
    getMediaUrl.mockReset();
    downloadMedia.mockReset();
    hasControllingServiceWorker.mockReturnValue(false);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn<() => string>(() => 'blob:gif-proxy'),
      })
    );
  });

  it('loads proxy-backed klipy gifs through authenticated blob fetches', async () => {
    getMediaUrl.mockImplementation((_mx, _mxc, useAuthentication) =>
      useAuthentication
        ? 'https://matrix.example.org/_matrix/client/v1/media/download/gifs.example.org/klipy_auth'
        : 'https://matrix.example.org/_matrix/media/v3/download/gifs.example.org/klipy_public'
    );
    downloadMedia.mockResolvedValue(new Blob(['gif'], { type: 'image/gif' }));

    renderWithProviders('mxc://gifs.example.org/klipy_Zm9vL2Jhci5naWY');

    await waitFor(() => {
      expect(screen.getByTestId('rendered-image')).toHaveAttribute('src', 'blob:gif-proxy');
    });

    expect(getMediaUrl).toHaveBeenCalledWith(
      expect.objectContaining({ getAccessToken: expect.any(Function) }),
      'mxc://gifs.example.org/klipy_Zm9vL2Jhci5naWY',
      true,
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(downloadMedia).toHaveBeenCalledWith(
      'https://matrix.example.org/_matrix/client/v1/media/download/gifs.example.org/klipy_auth',
      null
    );
  });

  it('direct-streams proxy-backed klipy gifs when a service worker controls the page', async () => {
    hasControllingServiceWorker.mockReturnValue(true);
    getMediaUrl.mockImplementation((_mx, _mxc, useAuthentication) =>
      useAuthentication
        ? 'https://matrix.example.org/_matrix/client/v1/media/download/gifs.example.org/klipy_auth'
        : 'https://matrix.example.org/_matrix/media/v3/download/gifs.example.org/klipy_public'
    );

    renderWithProviders('mxc://gifs.example.org/klipy_Zm9vL2Jhci5naWY');

    await waitFor(() => {
      expect(screen.getByTestId('rendered-image')).toHaveAttribute(
        'src',
        'https://matrix.example.org/_matrix/client/v1/media/download/gifs.example.org/klipy_auth'
      );
    });

    expect(downloadMedia).not.toHaveBeenCalled();
  });
});
