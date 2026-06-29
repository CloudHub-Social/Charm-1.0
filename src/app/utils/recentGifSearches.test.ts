import { afterEach, describe, expect, it } from 'vitest';
import { addRecentGifSearch, getRecentGifSearches } from './recentGifSearches';

describe('recentGifSearches', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('stores recent searches per user with case-insensitive dedupe', () => {
    expect(addRecentGifSearch('@alice:example.org', 'kiss')).toEqual(['kiss']);
    expect(addRecentGifSearch('@alice:example.org', 'Love')).toEqual(['Love', 'kiss']);
    expect(addRecentGifSearch('@alice:example.org', '  KISS  ')).toEqual(['KISS', 'Love']);

    expect(getRecentGifSearches('@alice:example.org')).toEqual(['KISS', 'Love']);
    expect(getRecentGifSearches('@bob:example.org')).toEqual([]);
  });

  it('trims to the maximum recent search count', () => {
    ['one', 'two', 'three', 'four', 'five', 'six', 'seven'].forEach((term) => {
      addRecentGifSearch('@alice:example.org', term);
    });

    expect(getRecentGifSearches('@alice:example.org')).toEqual([
      'seven',
      'six',
      'five',
      'four',
      'three',
      'two',
    ]);
  });
});
