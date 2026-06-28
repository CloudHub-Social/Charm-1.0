const KLIPY_STATIC_HOSTS = new Set(['static.klipy.com']);

export const normalizeGifProxyHost = (proxyUrl: string | undefined): string =>
  (proxyUrl ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

export const getKlipyRemoteId = (gifUrl: string): string | undefined => {
  try {
    const parsedGifUrl = new URL(gifUrl);
    if (!KLIPY_STATIC_HOSTS.has(parsedGifUrl.host)) return undefined;

    const normalizedPath = parsedGifUrl.pathname.replace(/^\/+/, '');
    const remoteId = normalizedPath.startsWith('ii/')
      ? normalizedPath.slice('ii/'.length)
      : normalizedPath;

    return remoteId.length > 0 ? remoteId : undefined;
  } catch {
    return undefined;
  }
};

export const isSupportedGifFavoriteUrl = (gifUrl: string): boolean =>
  gifUrl.startsWith('mxc://') || getKlipyRemoteId(gifUrl) !== undefined;
