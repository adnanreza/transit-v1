---
name: feature
description: Manage current feature workflow - load, start, test, review, explain or complete
argument-hint: load|start|test|review|explain|complete
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merged PR. Optimized for a public portfolio repo: clean branch-per-feature, multiple small commits within each branch, a descriptive PR that becomes the permanent record of *why*.

## Working File

@context/features/current-feature.md

## Feature Specs

All feature specs live in `context/features/` and follow a numbered naming convention:
- `01-data-pipeline.md`, `02-map-skeleton.md`, `03-frequency-coloring.md`, etc.
- Each spec includes Acceptance Criteria (used as goals), any Performance Budget it touches, and a Depends On section.

## Reference

Always read `SPEC.md` (repo root) before starting any feature — it defines the FTN rule, frequency bands, trip-pattern methodology, performance targets, and data pipeline. Features must not violate the spec without an explicit spec update in the same PR.

### File Structure

current-feature.md has these sections:

- `# Current Feature` — H1 heading with feature name when active
- `## Status` — Not Started | In Progress | Complete
- `## Goals` — Bullet points derived from the spec's Acceptance Criteria
- `## Notes` — Dependencies, performance budget, constraints from the spec
- `## History` — Completed features with dates and PR links (append only)

## Task

Execute the requested action: $ARGUMENTS

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Begin implementation on a feature branch, commit per goal |
| `test` | Write and run tests for testable logic (data pipeline, utils) |
| `review` | Check goals met, scope, performance budget, attribution |
| `explain` | Document what changed and why (used as PR body) |
| `complete` | Lint, typecheck, test, push branch, open PR |

See [actions/](actions/) for detailed instructions.

If no action provided, show current status from current-feature.md and list available actions.
