---
default: patch
---

Fix a CSS specificity regression from the Focus Highlights toggle (#539) that caused the inset focus ring on flush, clipped containers (e.g. `CutoutCard` rows in Account Data / Developer Tools) to be overridden by the default outset ring again, reintroducing the clipped-ring bug #519 had fixed.
