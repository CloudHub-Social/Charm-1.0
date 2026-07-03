---
default: patch
---

Increase SW watchdog ping timeout (5 s → 10 s) and consecutive-miss threshold (2 → 3) to tolerate transient iOS Safari service-worker suspension during room navigation, preventing spurious force-refreshes.
