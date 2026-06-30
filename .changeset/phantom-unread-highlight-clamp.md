---
default: patch
---

Fix phantom unread badge that persists (and climbs) after marking a room as read. The sliding-sync server can report a non-zero `highlight_count` after the client has already read those events; the old clamping logic skipped correction whenever highlights were present, so the badge stayed (and could jump higher on the next sync tick). Now both the total and highlight portions of the stale server count are subtracted, while genuine thread-level highlights are preserved.
