---
default: patch
---

Fix rooms (particularly bridge-heavy DMs) where the unread badge jumps UP after marking as read.

Two root causes were addressed:

1. When a room's recent timeline contains only metadata events (topic changes, membership updates) with no actual notification events from others, the stale server count was never clamped — the bridge bot's events didn't match the "all events from self" guard. Fixed by also clamping when the read marker itself is visible in the loaded timeline window.

2. When the latest timeline event is a thread reply whose thread isn't tracked by the SDK (common in bridge rooms), sending a threaded read receipt caused the local echo to bypass `getEventReadUpTo`, leaving `roomHaveUnread` operating against a stale fully-read marker. Fixed by sending an unthreaded receipt so the local echo is always reflected immediately.
