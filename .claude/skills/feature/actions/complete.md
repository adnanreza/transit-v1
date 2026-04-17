# Complete Action

Goal: ship the feature as a well-formed PR on GitHub. The PR (not a merge commit) is the permanent portfolio artifact.

1. Verify working tree is clean. If there are uncommitted changes, abort and tell the user to commit or stash.
2. Run quality gates — abort on any failure and report:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run build` (verify perf budget if the feature touches bundle or data output)
3. Generate the PR body by running the `explain` action and capturing its Markdown output.
4. Push the feature branch:
   ```
   git push -u origin <branch-name>
   ```
5. Open the PR with `gh pr create`:
   - Title: `<type>: <short description>` following Conventional Commits (e.g. `feat: compute per-pattern frequency bands`)
   - Body: the Markdown from `explain`, passed via a HEREDOC
   - Base: `main`
6. Print the PR URL so the user can review it in the browser.
7. **Stop here. Do not merge automatically.** The user reviews the PR on GitHub, makes any final adjustments, and merges when satisfied. Squash-merge is recommended for a clean `main` history; the PR page preserves the per-commit trail as the detailed record.
8. After the user confirms the PR is merged:
   - `git checkout main && git pull`
   - Delete the local feature branch: `git branch -d <branch-name>`
   - Delete the remote feature branch if GitHub didn't auto-delete it: `git push origin --delete <branch-name>`
   - Reset `context/features/current-feature.md`:
     - Change H1 back to `# Current Feature`
     - Clear Goals and Notes sections (keep placeholder comments)
     - Append to History: `- YYYY-MM-DD — <feature name> ([PR #N](<pr-url>))`
   - Commit the reset on main: `chore: reset current-feature.md after completing <feature>`
   - Push main: `git push`
