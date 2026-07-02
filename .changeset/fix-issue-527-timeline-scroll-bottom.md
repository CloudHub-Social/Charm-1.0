---
default: patch
---

Fix timeline not staying at live bottom when viewport shrinks (keyboard open, pickers, image viewer) on iOS Safari PWA. The ResizeObserver now checks the user's position against the _previous_ viewport height to catch the race where VList's onScroll sets `atBottomRef = false` before the observer fires.
