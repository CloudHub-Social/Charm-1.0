---
'charm': patch
---

Fix iOS safe-area regions appearing as pure-white bars at the top and bottom of the app. The status-bar and home-indicator insets are now painted with the surface color so they blend with the page header and message composer, and the safe-area offset is applied once at the app-shell level instead of on individual headers.
