---
'charm': patch
---

Fix authenticated media downloads crashing with an unhandled `TypeError: Failed to fetch` on network-level failures (e.g. CORS on redirected media URLs). Network errors during media fetch are now converted into a predictable 502 response instead of an unhandled rejection.
