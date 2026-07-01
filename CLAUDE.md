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

## Code navigation (graphify)

This repo has a prebuilt graphify knowledge graph at `graphify-out/graph.json` (gitignored — it's a local working artifact, not checked in). Prefer it over an open-ended `grep`/`Explore` sweep when the question is about architecture, "how does X work", "what calls Y", or cross-file relationships:

- `graphify query "<question>"` — BFS traversal for broad context on a question.
- `graphify explain "<Symbol>"` — plain-language explanation of a node and its neighbors.
- `graphify path "<A>" "<B>"` — shortest path between two concepts/symbols.

Fall back to `grep`/`Explore` for exact string/symbol lookups the graph wasn't built to answer, or if `graphify-out/graph.json` is missing. If the graph feels stale relative to very recent changes, refresh it incrementally with `graphify . --update` (only when a task actually depends on freshness — it's not needed every session).

## Automated hooks

Two repo-local hooks run automatically for every Claude Code session in this repo (see `.claude/settings.json` and `.claude/hooks/`):

- **`check-pr-base.sh`** (PreToolUse on `Bash`) — blocks any `gh pr create` that doesn't pass `--base integration` or `--base release/*`. If a PR create gets blocked, fix the `--base` flag rather than retrying with `--no-verify`-style workarounds.
- **`lint-on-edit.sh`** (PostToolUse on `Edit`/`Write`) — runs `oxlint` against a `.ts`/`.tsx` file immediately after it's edited and surfaces issues inline. Fix reported issues before moving on rather than deferring to a later manual lint pass.
