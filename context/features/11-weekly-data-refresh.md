# 11 — Weekly GTFS Data Refresh Cron

TransLink publishes GTFS updates roughly monthly; feed-version bumps change headways, add / remove routes, and nudge FTN qualification. Without automation, every refresh is a manual `npm run prepare-data` + commit + push, which means the deployed site drifts silently between manual touch-ups. SPEC §4.5 called out a weekly GitHub Action cron for exactly this reason — this feature ships it.

The job is deliberately conservative: it **opens a PR**, doesn't auto-merge. The PR gets a normal Netlify deploy preview, and a human verifies the changes (route count deltas, FTN winners/losers, file-size sanity) before promoting. Over time this becomes a one-click-a-week maintenance tax.

## Acceptance Criteria

### Workflow file

- `.github/workflows/refresh-data.yml` (new) with two triggers:
  - `schedule` — `cron: '0 6 * * 1'` (Mondays 06:00 UTC, which is Sunday 10–11 PM Pacific; quiet window, avoids upstream-traffic peaks).
  - `workflow_dispatch` — a button in the Actions tab to run on demand, primarily for first-deploy verification.
- Permissions block: `contents: write`, `pull-requests: write`. Minimum needed to push a branch + open a PR using the auto-provided `GITHUB_TOKEN`.

### Steps

1. Checkout `main` (full history — `peter-evans/create-pull-request` needs it to compute diffs).
2. Setup Node 20, cache npm.
3. `npm ci` (reproducible install).
4. `npm run prepare-data` — downloads TransLink GTFS, regenerates `public/data/{frequencies.json,routes.geojson,stops.geojson,meta.json}`.
5. Delegate branch + commit + PR creation to [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request) (pinned by SHA). The action:
   - No-ops if the working tree is clean (feed unchanged → no commit → no PR).
   - Creates (or updates) branch `data/refresh-<YYYY-MM-DD>`.
   - Commits with a message built from the run's `meta.json` — feed version + generated timestamp.
   - Opens a PR against `main` if none exists for that branch, updates it if one does.
6. Log a summary line in the job output so the Actions UI reads cleanly whether the run produced a PR or no-op'd.

### PR content

- **Title:** `chore: refresh GTFS data — <feed_version>`
- **Body:** Markdown summary emitted by a small inline script before the PR step. Uses `meta.json` + git diff stats to produce:
  - Feed version (old → new)
  - Route count delta (total + fixed-route)
  - FTN-qualifying route count delta
  - Total data-file size delta (gzipped)
  - Link back to the Actions run for debugging
- **Label** (if available): `data-refresh` — created out-of-band by the user if they want to filter; workflow attempts to set it and silently continues if the label doesn't exist yet.

### Detection / no-op behavior

- `meta.json` always changes (it embeds a `generated_at` ISO timestamp), so file-diff alone would produce a PR every week even when the feed is stale.
- The action handles this correctly: it commits only the files that differ, and if the *only* diff is `meta.json`, the commit still gets created but the PR body makes clear there's no real content change. Human reviewer closes without merging, which is cheap.
- A tighter alternative — skip PR creation when only `meta.json` changed — is possible but adds logic; punt unless it becomes noisy.

### Documentation

- **`README.md`** — add a one-sentence note under "Deploy model" pointing to the workflow: *"Data refreshes via a weekly GitHub Action (`.github/workflows/refresh-data.yml`) that opens a PR whenever the upstream GTFS feed changes."*

## Performance / Cost

- Public repos on GitHub get unlimited Actions minutes. Each run is ~2–3 min. Free.
- Network egress during the run: one GTFS zip (~8 MB) + PR creation API calls. Negligible.
- Storage for old `data/refresh-*` branches: GitHub auto-deletes on merge via the repo's default branch-deletion setting (assumed on; if not, cleanup is a one-liner later).

## Out of Scope

- **Auto-merge.** Explicit human review each week — the GTFS feed occasionally ships broken data (missing shapes, bad calendar entries) and silent auto-merge would poison the map.
- **Notifications** (Slack, email, Discord). The Actions "runs" page + the opened PR are the notification surface for v1.
- **Retention / cleanup of stale auto-branches.** GitHub auto-deletes after merge. If an auto-PR goes un-merged for months, we can tidy manually.
- **Running `prepare-basemap`.** Basemap regeneration is a deploy-time concern (already on every Netlify build); the data refresh doesn't touch it.
- **Running the app's test suite in the refresh job.** `prepare-data` is deterministic over GTFS; tests cover the library logic, not the data itself. Keep the job lean.
- **Weekday adjustment** if the Monday 06:00 UTC time is inconvenient. Easy follow-up — it's one cron line.

## Depends On

- `03 Frequency Computation` — `npm run prepare-data` is the entrypoint being invoked.
- `10 Deploy to Netlify` — merged auto-PRs trigger a Netlify deploy, closing the data-freshness loop.

## Notes

- **Why `peter-evans/create-pull-request`?** Hand-rolling `git checkout -b / commit / push / gh pr create` in a workflow works but duplicates edge-case handling the action already solves (identical PRs on rerun, filtering commits, signing). Pin it by SHA for supply-chain hygiene.
- **Why not auto-merge?** Stated above. Plus: auto-merging committed data hides regressions in the build script itself behind an unreviewed data delta.
- **Commit plan:**
  1. `feat: add github actions workflow for weekly gtfs data refresh`
  2. `docs: note the auto-refresh workflow in README's deploy model`
