---
'charm': patch
---

Reset the service-worker watchdog miss counter when the device comes back online, preventing a network-change-induced SW restart from triggering an unexpected page reload on mobile PWA.
