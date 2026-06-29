# Claude Code instructions for Charm

## Branch and PR rules

**All PRs must target the `integration` branch, not `dev` or `main`.**

- `integration` is the default branch for this repo. Every PR — features, bug fixes, dependency bumps, chores — goes there first.
- `dev` is not used as a merge target for this fork.
- `main` is reserved for production releases cut from `integration`.
- Release branches (e.g. `release/1.2.0`) may also be used as PR targets when backporting fixes.
- Always pass `--base integration` when running `gh pr create`.

## Changesets

Every user-facing change needs a changeset file in `.changeset/`. Run `pnpm run document-change` to generate one interactively, or create `.changeset/<descriptive-name>.md` manually:

```md
---
default: patch
---

Short user-facing summary of the change.
```

Internal/maintenance PRs with no user-facing impact can skip the changeset by applying the `internal` label.

## Labels

- `internal` — skips the changeset requirement for maintenance PRs.
