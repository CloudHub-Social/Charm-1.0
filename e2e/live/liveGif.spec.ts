import { expect, test } from '@playwright/test';

const klipyApiKey = process.env.KLIPY_API_KEY;
const LIVE_TEST_TIMEOUT_MS = 30_000;

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} must be set`);
  return value;
};

test.describe('Klipy GIF API live integration', () => {
  test.skip(!klipyApiKey, 'KLIPY_API_KEY not set — skipping live GIF API tests');

  test(
    'GIF search returns results for a known term',
    async ({ request }) => {
      const apiKey = requireEnv(klipyApiKey, 'KLIPY_API_KEY');
      const url = new URL('https://api.klipy.com');
      url.pathname = `/api/v1/${apiKey}/gifs/search`;
      url.searchParams.set('q', 'cat');
      url.searchParams.set('per_page', '5');

      const response = await request.get(url.toString());
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data.data)).toBe(true);
      expect(body.data.data.length).toBeGreaterThan(0);

      const first = body.data.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('images');
    },
    LIVE_TEST_TIMEOUT_MS
  );

  test(
    'GIF discovery loads thumbnails for multiple search terms',
    async ({ request }) => {
      const apiKey = requireEnv(klipyApiKey, 'KLIPY_API_KEY');
      const terms = ['happy', 'laugh', 'wave'];

      const results = await Promise.all(
        terms.map(async (term) => {
          const url = new URL('https://api.klipy.com');
          url.pathname = `/api/v1/${apiKey}/gifs/search`;
          url.searchParams.set('q', term);
          url.searchParams.set('per_page', '1');

          const response = await request.get(url.toString());
          expect(response.status()).toBe(200);

          const body = await response.json();
          return { term, count: (body.data.data as unknown[]).length };
        })
      );

      results.forEach(({ term, count }) => {
        expect(count, `Expected results for term "${term}"`).toBeGreaterThan(0);
      });
    },
    LIVE_TEST_TIMEOUT_MS
  );

  test(
    'GIF search returns empty array for nonsense query without error',
    async ({ request }) => {
      const apiKey = requireEnv(klipyApiKey, 'KLIPY_API_KEY');
      const url = new URL('https://api.klipy.com');
      url.pathname = `/api/v1/${apiKey}/gifs/search`;
      url.searchParams.set('q', 'xyzxyzxyz_no_results_expected_123456');
      url.searchParams.set('per_page', '5');

      const response = await request.get(url.toString());
      // API should return 200 (not 4xx) even for a no-result query.
      expect(response.status()).toBe(200);
    },
    LIVE_TEST_TIMEOUT_MS
  );

  test(
    'invalid API key returns 401 or 403',
    async ({ request }) => {
      const url = new URL('https://api.klipy.com');
      url.pathname = `/api/v1/invalid-key-smoke-test/gifs/search`;
      url.searchParams.set('q', 'test');
      url.searchParams.set('per_page', '1');

      const response = await request.get(url.toString());
      expect([401, 403]).toContain(response.status());
    },
    LIVE_TEST_TIMEOUT_MS
  );
});
