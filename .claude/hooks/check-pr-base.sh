#!/bin/bash
# Blocks `gh pr create` unless it targets `integration` or a `release/*` branch.
# See CLAUDE.md: "All PRs must target the `integration` branch, not `dev` or `main`."
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

if echo "$cmd" | grep -qE '(^|[;&|]|\s)gh\s+pr\s+create\b'; then
  if ! echo "$cmd" | grep -qE -- '--base[= ]+(integration|release/[^ ]+)\b'; then
    echo "Blocked: 'gh pr create' must pass --base integration (or --base release/x.y.z for backports). dev/main are not valid PR targets in this repo." >&2
    exit 2
  fi
fi
exit 0
