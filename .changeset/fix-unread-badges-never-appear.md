---
default: patch
---

Fix unread badges never appearing. A recent phantom-badge suppression pass could zero out every room's unread count at once, so badges stopped showing entirely. The over-aggressive suppression is reverted and replaced with a narrowly-scoped version: stale counts are only cleared when the room is genuinely read (never overriding receipt-confirmed unread), stale room-level highlight counts are cleared without dropping thread highlights, and DMs with only thread-only unreads are no longer force-highlighted.
