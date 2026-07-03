---
default: patch
---

Fix the mic-hold recorder not stopping when the press-and-hold gesture is interrupted (`pointercancel`, e.g. OS gesture takeover or scroll interrupt), which could leave audio recording running invisibly.
