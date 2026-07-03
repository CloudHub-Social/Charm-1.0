---
default: patch
---

Fix a CSS specificity bug that silently defeated the inset focus ring for flush `CutoutCard` rows (e.g. Settings → Developer Tools → Account Data), and made the inset ring ignore the Focus Highlights accessibility toggle.
