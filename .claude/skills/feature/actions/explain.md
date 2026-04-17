# Explain Action

Emits a PR-body-ready explanation of the feature. Used standalone for documentation, and consumed by `complete` as the PR description.

1. Read `context/features/current-feature.md` to understand what was implemented
2. Read the corresponding feature spec in `context/features/` for context on why
3. Run `git diff main...HEAD --name-status` to get list of files changed
4. Run `git log main..HEAD --oneline` to see the commit trail on this branch
5. For each file created or modified:
   - Show the file path
   - Give a 1–2 sentence explanation of what it does / what changed
   - Highlight key functions, components, or non-obvious patterns
6. End with a brief summary of how the pieces fit together
7. Note any deviations from the feature spec and why

## Output Format

Use this exact Markdown structure so `complete` can pass it straight to `gh pr create --body`:

```markdown
## Summary

One-paragraph summary of what this PR does and why. Reference the feature number (e.g. "Implements 03-frequency-coloring").

## Changes

**path/to/file.ts** (new)
Brief explanation of what this file does and why it was added.

**path/to/other.ts** (modified)
What changed and why.

## How It Connects

Short paragraph on the data/control flow between these files.

## Verification

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` under perf budget (initial JS < 300KB gz, data < 5MB)
- [ ] Manual checks: [list any from the review step]

## Spec Deviations

Any differences from SPEC.md or the feature spec, with reasoning. If none, write "None."
```
