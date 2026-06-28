---
default: patch
---

Send a terminal hidden-state update to the service worker when the app tears down its visibility heartbeat, so foreground notification state does not stay stale until the heartbeat expires.
