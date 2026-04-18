# Current Feature: 10 Deploy to Netlify

## Status

In Progress

## Goals

### Netlify project
- Netlify site connected to `adnanreza/transit-v1`, auto-deploys on push to `main`
- PR preview deploys enabled (Netlify default) — `deploy-preview-<n>.netlify.app` per PR
- Production URL on `<site-name>.netlify.app` — custom domain deferred
- Build command regenerates the gitignored basemap, then builds the Vite app

### Build pipeline
- `scripts/install-pmtiles-cli.sh` (new) — downloads pinned `go-pmtiles` Linux binary to `./bin/pmtiles` for CI; no-op on macOS (devs use `brew install pmtiles`)
- `scripts/prepare-basemap.sh` prepends `./bin:$PATH` so the CI-downloaded binary is picked up
- `package.json` gains `"prepare-basemap": "scripts/install-pmtiles-cli.sh && scripts/prepare-basemap.sh"`
- Netlify build command: `npm run prepare-basemap && npm run build`
- Netlify env: `NODE_VERSION=20`
- No `VITE_PMTILES_URL` override needed — default `/data/basemap.pmtiles` works

### Headers / caching
- `public/_headers` (new) with Netlify-native syntax:
  - `/data/*` → `Cache-Control: public, max-age=31536000, immutable`
  - `/assets/*` (Vite hashed bundles) → same immutable rule
  - Root / HTML gets Netlify's default (revalidating)

### Data refresh model (v1)
- GTFS-derived data (`frequencies.json`, `routes.geojson`, `stops.geojson`, `meta.json`) stays **committed** — refresh = `npm run prepare-data` + commit PR
- Basemap PMTiles regenerated on every deploy (always fresh from Protomaps daily)
- Weekly GTFS cron automated in follow-up feature 11

### Documentation
- `README.md` rewrite — what the app does, live URL, local dev (Node 20, `brew install pmtiles`, `npm install && npm run prepare-basemap && npm run dev`), data chain + attributions, deploy model
- `SPEC.md` deployment section updated from "Cloudflare Pages + R2" to "Netlify" with a 1-line rationale
- `.env.example` documenting `VITE_PMTILES_URL` for contributors who want to point at a different basemap host

### Verification
- Production deploy succeeds — site renders map + routes + stops at z≥13
- PR-preview deploy works end-to-end on a test PR
- DevTools Network tab confirms `/data/*` responses carry `cache-control: public, max-age=31536000, immutable`

## Notes

- Depends on: **01–09** (everything that makes the app render)
- **Why regenerate the basemap on every deploy?** Keeps repo lean (no 30 MB binary in git history); always fresh from Protomaps. Build time cost ~60–90 sec — acceptable.
- **Why Netlify over Cloudflare Pages + R2 (SPEC's original)?** Portfolio scale; cardless free tier; 100 MB per-asset limit fits the 30 MB basemap inline so no separate object store needed. Migrate to Cloudflare if bandwidth ever approaches 100 GB/mo cap.
- **What user does on Netlify (one-time)**:
  1. netlify.com → log in
  2. Add new site → Import from GitHub → authorize for `adnanreza/transit-v1`
  3. Build settings: base (empty), command `npm run prepare-basemap && npm run build`, publish `dist`
  4. Env var: `NODE_VERSION=20`
  5. Deploy; rename site via settings → shareable URL like `metro-van-ftn.netlify.app`
- Out of scope: custom domain, Cloudflare migration, weekly GTFS cron, branch deploys beyond PR previews, bundle tuning
- **Commit plan**:
  1. `feat: add install-pmtiles-cli shell script for Linux CI builds`
  2. `feat: wire prepare-basemap npm script to chain install + extract`
  3. `feat: add public/_headers with long-cache rules for /data/*`
  4. `chore: .env.example documenting VITE_PMTILES_URL`
  5. `docs: rewrite README with local dev + deploy instructions`
  6. `docs: update SPEC.md deployment section to Netlify`

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
