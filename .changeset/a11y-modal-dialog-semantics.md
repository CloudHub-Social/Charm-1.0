---
default: patch
---

Fix keyboard focus trapping in the "Remote themes" confirmation dialog and add dialog semantics (role="dialog", aria-modal) plus focus containment to the image and PDF viewers. Also fixes focus escaping to the page body when a dialog's ref is momentarily unavailable, restores focus trapping in the PDF viewer's "jump to page" popout and the image viewer, preserves backdrop-click-to-close for the PDF viewer, and adds an accessible-name API (`ariaLabel`/`ariaLabelledBy`) to `Modal500` dialogs.
