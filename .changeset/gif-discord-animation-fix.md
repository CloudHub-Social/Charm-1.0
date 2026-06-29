---
default: patch
---

Fix GIFs sent to Discord via the mautrix-discord bridge showing as still images. Discord only auto-animates images with a `.gif` filename extension; the previous `.webp` extension caused them to render as stills. Both fresh GIF sends and re-sends from the favorites board now use `.gif`.
