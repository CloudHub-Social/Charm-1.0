#!/bin/bash
# Runs oxlint against a single edited file right after Edit/Write, so lint
# errors surface immediately instead of at the next manual lint/CI run.
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PROJECT_DIR:-$PWD}"
oxlint="$root/node_modules/.bin/oxlint"
[ -x "$oxlint" ] || exit 0
[ -f "$file" ] || exit 0

out=$("$oxlint" "$file" 2>&1)
if [ -n "$out" ]; then
  echo "oxlint found issues in $file:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
