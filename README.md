# Metro Vancouver Frequent Transit Map

**Live:** [yvrtransit.netlify.app](https://yvrtransit.netlify.app/)

An interactive web map of TransLink's transit network, color-coded by service frequency. Distinguishes routes that qualify for the **Frequent Transit Network** (median headway ≤15 min every hour 06:00–21:00, on weekday + Saturday + Sunday) from peak-only and infrequent service.

TransLink's own maps are static PDFs and don't treat frequency as a first-class concept — this project fills that gap with a fast, frontend-only, static site.

→ [`SPEC.md`](SPEC.md) is the canonical product spec (FTN rule, frequency bands, trip-pattern methodology, perf targets, data pipeline).

## Stack

- **Vite + React 19 + TypeScript** (strict), **Tailwind v4**, **shadcn/ui**
- **MapLibre GL** for the map, **Protomaps PMTiles** for a dark base map extracted to a Metro Vancouver bbox at build time
- **nuqs** for URL state (filters, view, selected route all round-trip through the address bar)
- **Recharts** for the per-route headway chart (lazy-loaded with the detail panel so it stays out of the initial bundle)
- All data processed at build time from TransLink's GTFS feed — no backend, no tile server, no runtime API calls

Initial JS stays under 75 KB gz; the MapLibre chunk (~290 KB gz) and the detail panel (~105 KB gz with Recharts) are each lazy.

## Local development

Prereqs:
- **Node 20** (pinned in `.nvmrc`)
- **`pmtiles` CLI** — only needed to regenerate the local basemap extract:
  - macOS: `brew install pmtiles`
  - Linux: the `npm run prepare-basemap` script auto-downloads a pinned release binary into `./bin/`

```bash
npm install
npm run prepare-basemap    # extract a Metro Van basemap.pmtiles from Protomaps' daily build (~60 sec, first run)
npm run dev                # local dev server at http://localhost:5173
```

Other scripts:

```bash
npm run prepare-data       # re-run the GTFS build (downloads latest feed, computes headways + patterns)
npm run build              # production build to dist/
npm test                   # vitest
npm run typecheck
npm run lint
```

The basemap extract is gitignored (30 MB, regenerated per deploy). GTFS-derived data files (`public/data/{frequencies.json,routes.geojson,stops.geojson,meta.json}`) are committed; refresh loop is `npm run prepare-data` → commit.

## Deploy model

Auto-deployed to [Netlify](https://www.netlify.com/) on push to `main` — production at [yvrtransit.netlify.app](https://yvrtransit.netlify.app/). PR previews build at `deploy-preview-<n>--yvrtransit.netlify.app` for every open pull request.

Data refreshes via a weekly GitHub Action ([`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)) that regenerates the GTFS outputs every Monday morning UTC and opens a PR whenever the upstream feed has changed. Merged auto-PRs flow through the normal Netlify deploy.

Netlify build config:
- **Command:** `npm run prepare-basemap && npm run build` (extracts fresh basemap, then Vite builds)
- **Publish:** `dist`
- **Env:** `NODE_VERSION=20`

Cache headers for static data live in [`public/_headers`](public/_headers). The app's own URL is the share surface — selected route, filters, view, and thresholds all serialize to query params, so permalinks Just Work.

## Attribution

Transit data © [TransLink](https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources) (TransLink Open Data License).
Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under ODbL.

## License

MIT — see [`LICENSE`](LICENSE).

## Notes

Built with [Claude Code](https://claude.com/claude-code) using a per-feature PR workflow — each feature gets a spec in [`context/features/`](context/features/), its own branch, and a descriptive PR that becomes the permanent record. The workflow itself lives in [`.claude/skills/feature/`](.claude/skills/feature/).
