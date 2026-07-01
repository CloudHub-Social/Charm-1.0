#!/bin/bash
# Blocks `gh pr create` unless it targets `integration` or a `release/*` branch.
# See CLAUDE.md: "All PRs must target the `integration` branch, not `dev` or `main`."
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
  # Drop quoted substrings first, so a --base flag value can't be smuggled
  # past the check via an unrelated quoted argument, e.g.
  # `gh pr create --base dev --title "use --base integration"`.
  scan=$(echo "$cmd" | sed -E 's/"[^"]*"//g; s/'"'"'[^'"'"']*'"'"'//g')
else
  # jq unavailable: fall back to grepping the raw JSON directly rather than
  # silently disabling the check (a missing dependency shouldn't mean the
  # base-branch rule stops being enforced). Quote-stripping doesn't apply
  # here (this is JSON text, not a shell command line), so this fallback is
  # best-effort and can still be fooled by the smuggling case above — install
  # jq for the full check.
  scan="$input"
fi

if echo "$scan" | grep -qE '(^|[;&|]|[[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)'; then
  if ! echo "$scan" | grep -qE -- '--base[= ]+(integration|release/[^ ]+)([[:space:]]|$)'; then
    echo "Blocked: 'gh pr create' must pass --base integration (or --base release/x.y.z for backports). dev/main are not valid PR targets in this repo." >&2
    exit 2
  fi
fi
exit 0
