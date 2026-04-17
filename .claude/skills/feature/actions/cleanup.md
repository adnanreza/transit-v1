# Cleanup Action

Runs **after** the PR opened by `complete` has been merged on GitHub. Finalizes the feature: syncs main, deletes the feature branch (local + remote), resets the tracking file, and records the feature in History.

Keep this separate from `complete`. The human pause between "PR opened" and "PR merged" often spans sessions; treating `cleanup` as its own entry point means a fresh session can finalize work it didn't open.

1. Verify the PR is actually merged before touching anything. Read the branch name from `context/features/current-feature.md` (derive it the same way `start` did — lowercase H1 with spaces → dashes, prefixed `feature/`). Then:
   ```
   gh pr list --state merged --head <branch-name> --json number,url,mergedAt
   ```
   If no merged PR comes back, stop and tell the user. Do not proceed on assumption.
2. Capture the PR number and URL from that query — you'll need them for the History entry.
3. Sync main:
   ```
   git checkout main
   git pull
   ```
4. Delete the local feature branch:
   ```
   git branch -d <branch-name>
   ```
   Squash-merged branches will fail `-d` because git doesn't see the individual commits on main. That's expected — if the PR query in step 1 confirmed the merge, fall back to `git branch -D <branch-name>`.
5. Delete the remote feature branch if GitHub didn't auto-delete it:
   ```
   git push origin --delete <branch-name>
   ```
   Silently succeeds if the branch is already gone (GitHub usually auto-deletes on squash-merge).
6. Reset `context/features/current-feature.md`:
   - Change H1 back to `# Current Feature`
   - Set `## Status` to `Not Started`
   - Clear `## Goals` and `## Notes` (keep the section headers and their placeholder comments)
   - Append to `## History`: `- YYYY-MM-DD — <feature name> ([PR #N](<pr-url>))` using today's date in the user's local timezone
7. Commit the reset on main:
   ```
   git commit -am "chore: reset current-feature.md after completing <feature>"
   ```
8. Push main:
   ```
   git push
   ```
9. Confirm to the user: the feature name, the PR link, a line on what `main` now contains, and a pointer to run `/feature load <next-feature>` when they're ready.
