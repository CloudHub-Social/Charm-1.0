/* oxlint-disable vitest/require-mock-type-parameters */
import type * as DomModule from './dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusTrapFallbackFocus } from './dom';

const mediaTransport = vi.hoisted(() => ({
  fetchMediaBlob: vi.fn(),
}));

vi.mock('./mediaTransport', () => mediaTransport);

describe('loadImageElementFromMediaUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    mediaTransport.fetchMediaBlob.mockReset();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:loaded-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'img') {
        let currentSrc = '';
        let onload: ((event: Event) => void) | null = null;
        let onerror: ((event: Event | string) => void) | null = null;
        const listeners = new Map<string, (event: Event) => void>();

        return {
          addEventListener(type: string, handler: (event: Event) => void) {
            listeners.set(type, handler);
          },
          removeEventListener(type: string) {
            listeners.delete(type);
          },
          set onload(handler: ((event: Event) => void) | null) {
            onload = handler;
          },
          get onload() {
            return onload;
          },
          set onerror(handler: ((event: Event | string) => void) | null) {
            onerror = handler;
          },
          get onerror() {
            return onerror;
          },
          set src(value: string) {
            currentSrc = value;
            queueMicrotask(() => {
              const event = new Event('load');
              listeners.get('load')?.(event);
              onload?.(event);
            });
          },
          get src() {
            return currentSrc;
          },
        } as unknown as HTMLImageElement;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads images from transport-fetched blobs instead of direct remote urls', async () => {
    const stickerBlob = new Blob(['sticker'], { type: 'image/png' });
    mediaTransport.fetchMediaBlob.mockResolvedValue(stickerBlob);

    const dom = (await import('./dom')) as typeof DomModule & {
      loadImageElementFromMediaUrl: (url: string) => Promise<{
        blob: Blob;
        image: HTMLImageElement;
      }>;
    };
    const result = await dom.loadImageElementFromMediaUrl('https://example.org/sticker.png');

    expect(mediaTransport.fetchMediaBlob).toHaveBeenCalledWith(
      'https://example.org/sticker.png',
      undefined
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(stickerBlob);
    expect(result.blob).toBe(stickerBlob);
    expect(result.image.src).toBe('blob:loaded-image');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:loaded-image');
  });
});

describe('focusTrapFallbackFocus', () => {
  it('returns the ref element when it is populated', () => {
    const element = document.createElement('div');
    const ref = { current: element };

    expect(focusTrapFallbackFocus(ref)()).toBe(element);
  });

  it('throws a clear, attributable error instead of silently passing null to focus-trap', () => {
    // A raw `ref.current as HTMLElement` cast would silently pass `null`
    // through to focus-trap, which throws its own less-diagnosable error
    // ("`fallbackFocus` was specified but was not a node, or did not return
    // a node") deep inside `focus-trap`'s internals. This helper fails fast
    // and loud instead, at the actual source of the problem, before that
    // value ever reaches focus-trap - and does so without ever falling back
    // to `document.body`, which would silently reintroduce the "focus
    // escapes the trap" bug this code exists to prevent.
    const ref = { current: null };

    expect(() => focusTrapFallbackFocus(ref)()).toThrow(/container ref was null/);
  });
});
