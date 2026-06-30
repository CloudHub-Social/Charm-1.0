---
default: patch
---

Fix unread badge jumping up in bridge-heavy DMs after marking as read. Sending an unthreaded read receipt ensures the local echo is always reflected by `getEventReadUpTo`, preventing the stale fully-read marker from triggering a spurious unread highlight with the raw server count.
