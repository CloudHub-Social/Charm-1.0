---
default: patch
---

Auto-restart the search worker (up to 3 times) after an unexpected runtime termination on iOS Safari PWA. iOS can kill Web Workers under image-decode memory pressure; the search index now recovers silently instead of permanently disabling encrypted message search for the session.
