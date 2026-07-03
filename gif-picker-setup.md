# GIF Picker — Setup & Architecture

Sable's GIF picker is powered by [Klipy](https://klipy.com) and integrates directly into the emoji/sticker picker (EmojiBoard). GIFs are fetched from the Klipy API and proxied through your Matrix homeserver, keeping auth tokens out of third-party hands.

---

## Configuration

GIFs are enabled via `config.json`. Both fields are required:

```json
{
  "gifs": {
    "klipyApiKey": "YOUR_KLIPY_API_KEY",
    "proxyUrl": "https://your-matrix-homeserver.example"
  }
}
```

| Field         | Purpose                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `klipyApiKey` | Klipy API token. Obtain from [klipy.com](https://klipy.com). The placeholder value `SET_YOUR_TOKEN_HERE` is treated as absent.                                            |
| `proxyUrl`    | Your Matrix homeserver origin. GIF media is fetched through `/_matrix/client/v1/media/download` so the client never calls Klipy static hosts directly for media playback. |

If either field is absent or `klipyApiKey` equals the placeholder, the GIF tab is hidden and the EmojiBoard defaults to the Sticker tab.

---

## How GIF media is delivered

GIF images (animated WebP from Klipy) are served through two paths depending on the client state:

### Service-worker path (preferred)

When the Sable service worker is active and controlling the page, the client requests media via the Matrix `/download` endpoint. The SW intercepts these requests, injects the Matrix `Authorization` header, and passes them upstream. This works for both encrypted and unencrypted rooms and keeps the API token server-side.

The SW registers on install and calls `clients.claim()` so it takes control immediately on first load without requiring a page reload. `ImageContent.tsx` detects SW control via `navigator.serviceWorker.controller` before deciding to use direct-stream mode.

### Blob-fetch path (fallback)

When the SW is not yet active (first page load before claim completes, or environments where SWs are unsupported), `ImageContent` fetches the media as a blob using the Matrix access token and creates a temporary `blob:` URL. Animated images (GIF, APNG) are detected via MIME type or URL extension and rendered with `autoPlay`.

---

## Search and discovery

`useGifSearch` in `EmojiBoard.tsx` debounces input by 200 ms before calling `GET /api/v1/{apiKey}/gifs/search`. The controlled input value is updated synchronously (no flicker); only the API call is deferred.

`useGifDiscovery` pre-fetches one representative GIF for each of the popular search term chips shown on the GIF tab home screen. Results are cached at module level (`gifDiscoveryCache`) keyed by API key, so re-opening the GIF tab does not re-fire the 8 fetch calls.

---

## Mobile layout

| Surface                | Width          | Max width | Centering                                |
| ---------------------- | -------------- | --------- | ---------------------------------------- |
| Emoji / Sticker picker | `100vw − 32px` | 432px     | `left: 50%; transform: translateX(-50%)` |
| GIF picker             | `100vw − 16px` | 480px     | same                                     |

On tablets (`isPhoneLayoutDevice()` returns `false`) the picker is right-aligned to its trigger button via `getEmojiBoardRightOffset`, which accepts a `preferWide` flag to use the correct 480px board width for the GIF tab.

The mobile drag-resize handle uses `touch-action: none` on both the shell and the button to prevent the browser intercepting touch events as scroll gestures.

`getMobileSheetHeights` (in `src/app/components/emoji-board/mobileSheetHeights.ts`) computes `{ min, max, initial }` heights for each tab. `initial` is clamped to `[min, max]` to prevent the sheet from opening taller than its own maximum on short viewports (e.g. landscape phones).

---

## Telemetry

The following Sentry metrics are emitted (all under the `sable.*` namespace):

| Metric                   | Type         | Attributes                         | Description                                     |
| ------------------------ | ------------ | ---------------------------------- | ----------------------------------------------- |
| `sable.gif.search_ms`    | distribution | `result: ok \| error \| cancelled` | Klipy search request latency                    |
| `sable.gif.discovery_ms` | distribution | `cached: true \| false`            | Discovery pre-fetch latency (0 ms on cache hit) |

Errors from the Klipy API are captured via `Sentry.captureException` with `tags.feature = gif_picker` for easy filtering.

Breadcrumbs are added when:

- The GIF tab is opened (`category: gif_picker`, `message: GIF tab opened`)
- A GIF is sent (`category: gif_picker`, `message: GIF sent`, `data.source: search | discovery | favorites`)

---

## Testing

### Unit tests

- `src/app/features/room/emojiBoardPosition.test.ts` — `getEmojiBoardWidth` and `getEmojiBoardRightOffset` (including `preferWide`)
- `src/app/components/emoji-board/mobileSheetHeights.test.ts` — height clamp invariants across viewport sizes

### Smoke / Playwright layout tests

The dedicated `e2e/smoke/gif-picker.spec.ts` layout-harness spec has been removed (it rendered
fixture data outside the real app). GIF picker layout is currently exercised only via the live API
test below; add a real-route `captureSnapshot()` case to `e2e/smoke/observability.spec.ts` (and
register it in `test:e2e:snapshots` in `package.json`) if dedicated layout regression coverage is
needed again.

### Live API tests

Requires a real Klipy API key. Run:

```bash
KLIPY_API_KEY=your_key npx playwright test e2e/live/liveGif.spec.ts
```

Tests are skipped automatically when `KLIPY_API_KEY` is not set.

---

## Known limitations

- **Path-prefixed homeservers**: The SW matches `/_matrix/client/v1/media/download` as an absolute path, so homeservers mounted under a sub-path (e.g. `https://host/matrix/_matrix/...`) are not matched. This is a project-wide architectural assumption, not specific to the GIF feature.
- **OG image GIF detection**: For Matrix-hosted GIFs linked as `og:image`, animated detection relies on `og:image:type` or `ogImageInfo.mimetype`. If neither is present (some homeserver preview implementations omit them) the image is thumbnailed rather than streamed. Safe fallback; full fix requires the homeserver to populate the mime type.
