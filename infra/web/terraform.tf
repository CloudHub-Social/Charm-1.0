terraform {
  required_version = "~> 1.11.0"

  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      # cloudflare_worker's observability.logs.destinations and the whole
      # observability.traces block (needed to export to the sentry-charm-1-
      # logs/sentry-charm-1-traces Observability Destinations) aren't in the
      # provider schema until somewhere between 5.18.0 (previously pinned
      # here) and 5.21.1 — confirmed absent/present respectively by diffing
      # `tofu providers schema -json` output between those two versions.
      # 5.21.1 rather than the newer 5.22.0: at the time of this change,
      # registry.opentofu.org (this repo's provider source) hadn't mirrored
      # 5.22.0 yet, so `tofu init` would fail to resolve it; 5.21.1 was the
      # newest version actually available there with the fields we need.
      version = ">= 5.21.1, < 6.0.0"
    }
  }
}
