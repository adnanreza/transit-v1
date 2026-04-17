# Complete Action

Opens the PR that will become the permanent portfolio artifact. **Stops before merge** — the human reviews and merges on GitHub. Post-merge finalization is a separate action (`cleanup`) so that the hand-off survives across sessions.

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
   - Body: the Markdown from `explain`, passed via a HEREDOC or `--body-file`
   - Base: `main`
6. Print the PR URL so the user can review it in the browser.
7. **Stop.** The user reviews the PR on GitHub, makes any final adjustments, and merges when satisfied. Squash-merge is recommended for a clean `main` history; the PR page preserves the per-commit trail as the detailed record.

Once merged, the next step is the `cleanup` action — don't run it from `complete`, since the human pause between "PR opened" and "PR merged" can span sessions.
