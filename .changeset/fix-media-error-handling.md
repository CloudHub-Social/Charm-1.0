---
default: patch
---

Fix unhandled promise rejections from encrypted media decrypt failures, and wire OIDC token refresh to propagate new tokens to the service worker so authenticated media requests no longer 401 after token expiry.
