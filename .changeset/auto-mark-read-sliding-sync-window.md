---
default: patch
---

Fix rooms (particularly bridge-heavy DMs) where the unread badge jumps UP after marking as read. When a room's recent timeline contains only metadata events (topic changes, membership updates) with no actual notification events, the stale server count was never clamped — the bridge bot's events didn't match the "all events from self" guard. The fix also clamps when the read marker itself is present in the loaded timeline window, which covers the common case of a user marking a room as read while the recent events happen to be non-notification types.
