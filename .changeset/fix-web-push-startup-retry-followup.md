---
default: patch
---

Retry failed web push startup reconciliation attempts within the same session so transient startup errors do not leave notification delivery scoped incorrectly until another lifecycle change happens.
