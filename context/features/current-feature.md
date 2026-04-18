# Current Feature: 11 Weekly GTFS Data Refresh Cron

## Status

In Progress

## Goals

### Workflow file
- `.github/workflows/refresh-data.yml` (new) with two triggers:
  - `schedule` — `cron: '0 6 * * 1'` (Mondays 06:00 UTC; Sunday 10–11 PM Pacific)
  - `workflow_dispatch` — manual Run-workflow button for first-deploy verification
- Permissions: `contents: write`, `pull-requests: write` (auto-provided `GITHUB_TOKEN`)

### Steps
- Checkout main (full history)
- Setup Node 20 + npm cache
- `npm ci`
- `npm run prepare-data` — regenerates `public/data/{frequencies.json,routes.geojson,stops.geojson,meta.json}`
- Delegate branch + commit + PR to `peter-evans/create-pull-request` (pinned by SHA):
  - No-ops on clean tree
  - Branch `data/refresh-<YYYY-MM-DD>`, updates existing PR if one is open for that branch
  - Commit message built from meta.json (feed version + generated timestamp)
- Log summary line so Actions UI reads cleanly whether PR opened or no-op

### PR content
- Title: `chore: refresh GTFS data — <feed_version>`
- Body: inline script emits markdown summary using meta.json + diff stats:
  - Feed version old → new
  - Route count delta (total + fixed-route)
  - FTN-qualifying route count delta
  - Data file size delta (gzipped)
  - Link back to Actions run
- Try to apply `data-refresh` label; silently continue if missing

### Detection / no-op
- `meta.json` always changes (generated_at timestamp); the action commits only differing files
- If ONLY meta.json differs, PR body makes clear there's no content change → human closes
- Tighter "skip if only meta.json" logic is punt-able until noisy

### Documentation
- README — one sentence under Deploy model: *"Data refreshes via a weekly GitHub Action (`.github/workflows/refresh-data.yml`) that opens a PR whenever the upstream GTFS feed changes."*

## Notes

- Depends on: **03** (pipeline), **10** (deploy — merged PRs auto-deploy)
- **Why `peter-evans/create-pull-request`?** Handles re-run dedup, branch/commit/push/PR in one; pin by SHA for supply-chain hygiene
- **Why not auto-merge?** GTFS occasionally ships broken data (bad calendar, missing shapes); also shields against regressions in build-data.ts itself
- **Pre-`/feature start` user step:** Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests" (done ✓)
- Out of scope: auto-merge, notifications (Slack/Discord/email), stale-branch cleanup, prepare-basemap in this job, app test suite in this job, weekday adjustment
- Public repos: unlimited GH Actions minutes; each run ~2–3 min
- **Commit plan**:
  1. `feat: add github actions workflow for weekly gtfs data refresh`
  2. `docs: note the auto-refresh workflow in README's deploy model`

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
- 2026-04-17 — 05 Frequency Coloring ([PR #5](https://github.com/adnanreza/transit-v1/pull/5))
- 2026-04-17 — 06 Controls ([PR #6](https://github.com/adnanreza/transit-v1/pull/6))
- 2026-04-17 — 07 URL State ([PR #7](https://github.com/adnanreza/transit-v1/pull/7))
- 2026-04-17 — 08 Route Detail Panel + Hover Tooltip ([PR #8](https://github.com/adnanreza/transit-v1/pull/8))
- 2026-04-17 — 09 Stops Layer ([PR #9](https://github.com/adnanreza/transit-v1/pull/9))
- 2026-04-18 — 10 Deploy to Netlify ([PR #11](https://github.com/adnanreza/transit-v1/pull/11))
