import { useState, useEffect } from 'react';

const imageBlobCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

// Concurrency limiter: cap simultaneous remote fetches to avoid N+1 API call
// detection when many components (e.g. room-list avatars) mount at once.
const MAX_CONCURRENT_FETCHES = 4;
let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

function acquireFetchSlot(): Promise<void> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    fetchQueue.push(resolve);
  });
}

function releaseFetchSlot(): void {
  const next = fetchQueue.shift();
  if (next) {
    next();
  } else {
    activeFetches -= 1;
  }
}

export function getBlobCacheStats(): {
  cacheSize: number;
  inflightCount: number;
  queueDepth: number;
} {
  return {
    cacheSize: imageBlobCache.size,
    inflightCount: inflightRequests.size,
    queueDepth: fetchQueue.length,
  };
}

export function useBlobCache(url?: string): string | undefined {
  const [cacheState, setCacheState] = useState<{ sourceUrl?: string; blobUrl?: string }>({
    sourceUrl: url,
    blobUrl: url ? imageBlobCache.get(url) : undefined,
  });

  if (url !== cacheState.sourceUrl) {
    setCacheState({
      sourceUrl: url,
      blobUrl: url ? imageBlobCache.get(url) : undefined,
    });
  }

  useEffect(() => {
    if (!url || imageBlobCache.has(url)) return undefined;

    // Blob URLs are already in-memory object URLs — no need to re-fetch them.
    // Fetching a blob: URL just to create another blob URL is redundant and
    // causes the N+1 API call pattern when many components mount simultaneously.
    if (url.startsWith('blob:')) {
      imageBlobCache.set(url, url);
      setCacheState({ sourceUrl: url, blobUrl: url });
      return undefined;
    }

    let isMounted = true;

    const fetchBlob = async () => {
      if (inflightRequests.has(url)) {
        try {
          const existingBlobUrl = await inflightRequests.get(url);
          if (isMounted) setCacheState({ sourceUrl: url, blobUrl: existingBlobUrl });
        } catch {
          // Inflight request failed, silently ignore (consistent with fetchBlob behavior)
        }
        return;
      }

      const requestPromise = (async () => {
        await acquireFetchSlot();
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) {
            throw new Error(`Failed to fetch blob: ${res.status} ${res.statusText}`);
          }
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);

          imageBlobCache.set(url, objectUrl);
          return objectUrl;
        } catch (e) {
          inflightRequests.delete(url);
          throw e;
        } finally {
          releaseFetchSlot();
        }
      })();

      inflightRequests.set(url, requestPromise);

      try {
        const finalBlobUrl = await requestPromise;
        if (isMounted) {
          setCacheState({ sourceUrl: url, blobUrl: finalBlobUrl });
        }
      } catch {
        // silency fail... mrow
      } finally {
        inflightRequests.delete(url);
      }
    };

    fetchBlob();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return cacheState.blobUrl || url;
}
