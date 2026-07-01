---
default: patch
---

Migrate recently-used emoji storage to the stable `m.recent_emoji` account data key, with automatic fallback and migration from the legacy `io.element.recent_emoji` key so existing recent-emoji history isn't lost.
