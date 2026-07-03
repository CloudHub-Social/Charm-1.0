---
default: patch
---

Fix the app-wide keyboard focus ring getting clipped inside `overflow: hidden` containers (e.g. Settings → Developer Tools → Account Data rows), by drawing an inset ring for focusable elements flush inside a `CutoutCard`.
