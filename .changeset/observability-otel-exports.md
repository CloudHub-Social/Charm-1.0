---
default: patch
---

Export Worker logs and traces to the sentry-charm-1-logs/sentry-charm-1-traces Observability Destinations, bumping the Cloudflare Terraform provider constraint to a version that supports `observability.logs.destinations` and the `observability.traces` block.
