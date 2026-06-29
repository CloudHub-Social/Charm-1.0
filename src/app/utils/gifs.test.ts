import { describe, expect, it } from 'vitest';
import { getKlipyRemoteId, isKlipyProxyMxc, normalizeGifProxyHost } from './gifs';

describe('gifs utils', () => {
  it('normalizes proxy hosts', () => {
    expect(normalizeGifProxyHost('https://gifs.example.org/')).toBe('gifs.example.org');
    expect(normalizeGifProxyHost('gifs.example.org///')).toBe('gifs.example.org');
  });

  it('extracts Klipy remote ids from supported CDN urls', () => {
    expect(
      getKlipyRemoteId('https://static.klipy.com/ii/a1/b2/example.gif?token=123#preview')
    ).toBe('a1/b2/example.gif');
  });

  it('recognizes proxy-backed Klipy MXCs', () => {
    expect(
      isKlipyProxyMxc('mxc://gifs.example.org/klipy_Zm9vL2Jhci5naWY', 'https://gifs.example.org')
    ).toBe(true);
    expect(isKlipyProxyMxc('mxc://matrix.org/klipy_Zm9vL2Jhci5naWY', 'gifs.example.org')).toBe(
      false
    );
    expect(isKlipyProxyMxc('mxc://gifs.example.org/plain_media_id', 'gifs.example.org')).toBe(
      false
    );
  });
});
