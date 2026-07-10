variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "custom_domain" {
  description = "Custom domain attached to the Worker"
  type        = string
  # "charm.cloudhub.social" belongs to the 2.0 rewrite (CloudHub-Social/Charm);
  # this repo's actual deployed identity is charm-1/charm-1.cloudhub.social
  # (see the CI plan for PR #560, which showed the previous "charm.cloudhub.social"
  # default about to destroy+recreate this Worker's custom domain and rename
  # it to "charm" — that default was wrong since 210069ae1 "docs: complete
  # Charm repo branding" landed 2.0's identity here instead of 1.0's, and the
  # deploy workflow never overrides it with TF_VAR_custom_domain).
  default = "charm-1.cloudhub.social"
}

variable "worker_name" {
  description = "Cloudflare Worker name"
  type        = string
  # See custom_domain's comment above — same bug, same fix.
  default = "charm-1"
}

variable "workers_message" {
  description = "Optional short message attached to Worker deployments"
  type        = string
  default     = null
}

variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
  sensitive   = true
}
