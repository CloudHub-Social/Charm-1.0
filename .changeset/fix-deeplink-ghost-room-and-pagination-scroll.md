---
default: patch
---

Fix ghost room on notification deeplink and viewport jump during history-context pagination.

Notification deeplinks no longer show a near-empty "ghost room" containing only the linked-to message: proactive pagination now fires at 0 ms (immediately after the initial context scroll) instead of 500 ms, so surrounding events load before the user sees the timeline.

History-context deeplinks no longer jump the viewport to the wrong message when pagination fires: the focus-item's absolute index is now re-resolved from the event ID after every backward paginate (which shifts all indices), and the VList shift-anchor is always engaged for history-context loads so prepended events cannot displace the focused message during the proactive-load window.
