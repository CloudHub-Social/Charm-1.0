---
default: patch
---

Fix rooms that stay stuck with an unread badge after switching to them. When a room's fully-read marker (`m.fully_read`) was set on an older device and points to an event outside the sliding-sync timeline window, the auto-mark-as-read logic couldn't locate the marker in any loaded timeline and silently skipped sending the read receipt. Now, when the read marker is not found in any loaded timeline (event predates the window), the room is treated as viewed at the live end and marked as read correctly.
