---
'charm': patch
---

Fix notch overlap on ImageEditor, TextViewer, and PdfViewer modals: add `env(safe-area-inset-top)` padding to their headers on viewports ≤600px so the close button is reachable on iPhones with a notch or Dynamic Island.
