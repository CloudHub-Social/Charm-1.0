#!/bin/bash
# Blocks `gh pr create` unless it targets `integration` or a `release/*` branch.
# See CLAUDE.md: "All PRs must target the `integration` branch, not `dev` or `main`."
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

if echo "$cmd" | grep -qE '(^|[;&|]|[[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$)'; then
  if ! echo "$cmd" | grep -qE -- '--base[= ]+(integration|release/[^ ]+)([[:space:]]|$)'; then
    echo "Blocked: 'gh pr create' must pass --base integration (or --base release/x.y.z for backports). dev/main are not valid PR targets in this repo." >&2
    exit 2
  fi
fi
exit 0
