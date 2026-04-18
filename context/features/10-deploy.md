# 10 — Deploy to Netlify

Ship the app so it has a real URL reviewers can click. Deploying is also a forcing function — it exposes real-world issues that local `npm run dev` hides (just caught one from 08 that had been shipped for two features).

SPEC originally called for Cloudflare Pages + R2. Revisited for a portfolio-scale project: Netlify is simpler for a first deploy, doesn't require a card on file, and handles the 30 MB basemap inline (Cloudflare Pages' 25 MB per-file limit was the primary driver for R2; Netlify's 100 MB per-asset cap fits). We'll document the re-decision in this PR and revisit if bandwidth ever becomes a problem.

## Acceptance Criteria

### Netlify project

- Netlify site connected to `adnanreza/transit-v1`, auto-deploys on push to `main`.
- PR preview deploys enabled (Netlify default) — every open PR gets its own `deploy-preview-<n>.netlify.app` URL.
- Production URL is `<site-name>.netlify.app` (custom domain deferred).
- Build command regenerates the gitignored basemap, then builds the Vite app.

### Build pipeline

- **`scripts/install-pmtiles-cli.sh` (new)** — downloads the `go-pmtiles` Linux binary to `./bin/pmtiles` for CI builds. No-op / informative log on macOS where devs use `brew install pmtiles`. Pins a specific version of `go-pmtiles` so deploys stay reproducible.
- **`scripts/prepare-basemap.sh` (modified)** — prepend `./bin:$PATH` before invoking `pmtiles` so the downloaded binary is found without a global install.
- **`package.json` (modified)** — add `"prepare-basemap": "scripts/install-pmtiles-cli.sh && scripts/prepare-basemap.sh"`. Existing direct invocations still work.
- **Netlify build command:** `npm run prepare-basemap && npm run build`.
- **Netlify env:** `NODE_VERSION=20`.
- No env var needed for `VITE_PMTILES_URL` — the default `/data/basemap.pmtiles` is what the build produces.

### Headers / caching

- **`public/_headers` (new)** — Netlify-native syntax:
  - `/data/*` → `Cache-Control: public, max-age=31536000, immutable`. Safe because those files are content-versioned via PR-commit (weekly cron later will open a new PR rather than mutate in place), so URL-never-changes-but-content-does can't happen.
  - `/assets/*` (Vite's hashed bundle output) → same immutable rule.
  - Root / HTML gets Netlify's default (revalidating).

### Data refresh model (v1)

- GTFS-derived data (`frequencies.json`, `routes.geojson`, `stops.geojson`, `meta.json`) stays **committed** to the repo. Deploys serve what main says; `npm run prepare-data` + commit is the refresh loop.
- Basemap PMTiles is regenerated on every deploy (always fresh from Protomaps' daily build). Trades ~60–90 sec of build time for zero manual update overhead.
- Automating GTFS regen via a weekly GitHub Action → its own feature (11).

### Documentation

- **`README.md` (rewrite)** — currently minimal. New content: what the app does (1–2 lines), live URL, quick local-dev instructions (Node 20, `brew install pmtiles`, `npm install && npm run prepare-basemap && npm run dev`), data chain + attributions, deploy model.
- **`SPEC.md` deployment section (update)** — change "Cloudflare Pages + R2" to "Netlify", with a 1-line note explaining the re-decision.
- **`.env.example` (new)** — documents `VITE_PMTILES_URL` for contributors who want to point at an alternate basemap host.

### Verification

- Production deploy succeeds; `<site>.netlify.app` renders the map, colored routes, stops at z≥13.
- PR-preview deploy works end-to-end on a test PR.
- Lighthouse (or at minimum devtools network tab) confirms `/data/*` responses carry `cache-control: public, max-age=31536000, immutable`.

## Performance / Data Budget

- Deploy size: `dist/` (~430 KB gz of JS + CSS) + basemap (30 MB) ≈ 30.5 MB per deploy. Within Netlify's 100 MB per-asset cap (basemap is the largest single file).
- Build time budget: pmtiles binary download (~20 MB, seconds) + basemap extract (~60 sec typical) + Vite build (~1 sec) ≈ ≤2 min total. Netlify free tier gives 300 build minutes/mo — easily within.
- Bandwidth: Netlify free tier is 100 GB/mo outbound. PMTiles uses HTTP range requests, so a full-map visit transfers ~1–3 MB of basemap tiles (not the whole 30 MB). Realistic capacity well above portfolio traffic.

## Out of Scope

- **Custom domain.** Ships on `*.netlify.app`. Adding DNS + cert later is a trivial follow-up, not worth blocking this PR.
- **Cloudflare migration.** If traffic ever approaches the 100 GB/mo cap, re-evaluate. Out of scope until then.
- **Weekly GTFS cron.** SPEC §4.5; its own feature (11).
- **Branch deploys** beyond the default PR-preview behavior.
- **Bundle splitting / further perf work.** Already under budget; any tuning is its own feature.

## Depends On

- `01`–`09` — everything that makes the app actually render.

## Notes

- **Why regenerate the basemap on every deploy?** The alternative — checking in a pre-extracted 30 MB binary — bloats the git history and gets stale. Build-time extraction always mirrors Protomaps' latest daily build and keeps the repo lean. If build time becomes a problem we can add a cache step, but 60 sec extract is acceptable for portfolio cadence.
- **Why not Cloudflare + R2?** Netlify wins on setup simplicity and cardlessness for a portfolio deploy. Cloudflare wins on bandwidth + egress economics at scale. We're not at scale.
- **What the user has to do on Netlify** (one-time):
  1. Log into `netlify.com` with the existing account.
  2. Add new site → Import from GitHub → authorize Netlify's GitHub app for `adnanreza/transit-v1` if not already.
  3. Pick the repo. Build settings:
     - Base directory: (empty)
     - Build command: `npm run prepare-basemap && npm run build`
     - Publish directory: `dist`
  4. Environment variables (site settings → environment): `NODE_VERSION=20`.
  5. Deploy. First build takes ~2 min. Site lands on `<auto-generated>.netlify.app`; rename via Site settings → Change site name to something like `metro-van-ftn`.
- **Commit plan**:
  1. `feat: add install-pmtiles-cli shell script for Linux CI builds`
  2. `feat: wire prepare-basemap npm script to chain install + extract`
  3. `feat: add public/_headers with long-cache rules for /data/*`
  4. `chore: .env.example documenting VITE_PMTILES_URL`
  5. `docs: rewrite README with local dev + deploy instructions`
  6. `docs: update SPEC.md deployment section to Netlify`
