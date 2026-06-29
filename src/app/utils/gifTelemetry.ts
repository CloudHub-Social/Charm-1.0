import * as Sentry from '@sentry/react';

export function recordGifSearchMs(
  durationMs: number,
  attributes: { result: 'ok' | 'error' | 'cancelled' }
): void {
  Sentry.metrics.distribution('sable.gif.search_ms', durationMs, { attributes });
}

export function recordGifDiscoveryMs(durationMs: number, attributes: { cached: boolean }): void {
  Sentry.metrics.distribution('sable.gif.discovery_ms', durationMs, { attributes });
}

export function captureGifSearchError(err: unknown, query: string): void {
  Sentry.captureException(err, {
    tags: { feature: 'gif_picker', operation: 'search' },
    contexts: { gif_search: { query_length: query.length } },
  });
}

export function captureGifDiscoveryError(err: unknown, term: string): void {
  Sentry.captureException(err, {
    tags: { feature: 'gif_picker', operation: 'discovery' },
    contexts: { gif_discovery: { term } },
  });
}

export function addGifSentBreadcrumb(source: 'search' | 'discovery' | 'favorites'): void {
  Sentry.addBreadcrumb({
    message: 'GIF sent',
    category: 'gif_picker',
    level: 'info',
    data: { source },
  });
}

export function addGifTabOpenedBreadcrumb(): void {
  Sentry.addBreadcrumb({
    message: 'GIF tab opened',
    category: 'gif_picker',
    level: 'info',
  });
}
