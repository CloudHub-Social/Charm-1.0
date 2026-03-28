---
default: patch
---

Fix unhandled promise rejections from encrypted media decrypt failures, wire OIDC token refresh to propagate new tokens to the service worker, eliminate the SW startup race that caused initial media 401s, and ensure the session cache is always flushed before the service worker can be killed (preventing intermittent 401s after token refresh on iOS and other aggressive SW-terminating browsers).
