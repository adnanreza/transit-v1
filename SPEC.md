# Metro Vancouver Frequent Transit Map — Spec

## Overview

An interactive web map of Metro Vancouver's transit network, color-coded by service frequency. The map distinguishes routes that qualify as part of the **Frequent Transit Network (FTN)** — every 15 min or better, all day, every day — from peak-only and infrequent routes.

TransLink's own maps are static PDFs and don't treat frequency as a first-class concept. This project fills that gap: fast, opinionated, open source, frontend-only.

## Goals

- Show, at a glance, which routes are "turn up and go" vs. which require checking a schedule.
- Let users see how the network changes by day type (weekday / Saturday / Sunday) and time of day.
- Feel instant — no loading spinners after initial load.
- Ship as a pure static site. No backend, no tile server.

## Non-Goals (v1)

- Real-time vehicle positions or arrival predictions.
- Trip planning / routing.
- Historical data or schedule-change diffs over time.
- Fare zones, transfers, accessibility details.
- Mobile-first UX. Desktop-first is fine; it should still work on mobile, but power features can assume a larger screen.

## Target User

Transit-curious Vancouverites, urbanism folks, people deciding whether a neighborhood is transit-accessible. Secondarily: portfolio reviewers.

## Data Sources

- **TransLink GTFS static feed** — routes, trips, stops, stop times, calendar, shapes. Published under TransLink's open data license; attribution required.
- **Protomaps PMTiles (OSM-derived)** for base map. Free, served as a single file from any static host. ODbL attribution required.

All data is processed at build time. Zero runtime API calls.

## Definitions

- **Frequent Transit Network (FTN):** a route qualifies if its median headway is ≤15 min in every hour-long window from 06:00 to 21:00, on *all three* day types (weekday, Saturday, Sunday/holiday). One failing hour on one day type disqualifies the route. Stricter than an all-day average, and matches how riders actually experience FTN service.
- **Frequency bands** (defaults, user can change):
  - Very frequent: ≤10 min
  - Frequent: ≤15 min (FTN threshold)
  - Standard: ≤30 min
  - Infrequent: >30 min
  - Peak only: service confined to AM/PM peaks (rendered dashed)
  - Night only: service confined to ~10pm–5am, e.g. NightBus (rendered dashed)
- **Day types:** weekday, Saturday, Sunday/holiday. Derived from GTFS `calendar.txt` and `calendar_dates.txt`. Dates with a holiday exception are counted as Sunday service.
- **Trip patterns:** a route can run multiple stop sequences (e.g. the 99 has express and short-turn variants). Headways are computed **per trip pattern** at the pattern's busiest stop. A route is displayed at the band of its *worst pattern that carries ≥20% of the route's trips* — prevents a dominant pattern from hiding a branch with half the service. The detail panel breaks patterns out separately.
- **Headway:** median gap between consecutive scheduled trips within the selected window. Median, not mean — avoids skew from long early-morning/late-night gaps.

## Functional Requirements

### Map

- Full-screen MapLibre GL map centered on Metro Vancouver.
- Routes rendered as colored lines over a muted base map.
- Color encodes frequency band for the **currently selected day type + time window**.
- SkyTrain, SeaBus, and West Coast Express styled distinctly (thicker lines, mode-specific colors).
- Stops shown at a zoom level where they don't clutter.
- Hover a route: highlight + tooltip (route number, name, current band).
- Click a route: open side panel with route detail.

### Controls

- **Day type toggle:** Weekday / Saturday / Sunday (single-select).
- **Time window toggle:** All day / AM peak (6–9am) / Midday / PM peak (3–6pm) / Evening / Late night.
- **Mode filter:** checkboxes for Bus, SkyTrain, SeaBus, West Coast Express.
- **Frequency threshold slider** (or preset bands): let users redefine "frequent" and watch the map shift. This is the interaction that sells the concept.
- **Search:** jump-to by route number or neighborhood name.

### Route Detail Panel

- Route name, number, operator.
- 24-hour frequency profile across the three day types (small multiples line chart).
- FTN qualification status (✓ / ✗) with a one-line explanation of which window fails if ✗.
- List of termini and major stops.

### Legend

- Always visible. Updates live when frequency thresholds change.

### URL State

- Day type, time window, mode filters, and thresholds all serialize to the URL. Shareable permalinks out of the box.

## Technical Architecture

### Build pipeline

A Node script (`scripts/build-data.ts`) runs on `npm run prepare-data`:

1. Download the latest TransLink GTFS zip. Cache locally; skip re-download if the feed hash hasn't changed.
2. Stream-parse CSVs (`stop_times.txt` is the big one — don't load it into memory whole).
3. For each route × day type × time window, compute the median headway at the busiest stop.
4. Emit:
   - `public/data/routes.geojson` — route geometries from `shapes.txt`, simplified with mapshaper (target <3MB gzipped), with route metadata in properties.
   - `public/data/frequencies.json` — lookup keyed by `route_id → day_type → time_window → headway_minutes`.
   - `public/data/stops.geojson` — stop locations.
   - `public/data/meta.json` — feed version, generation timestamp, attribution strings.
5. Weekly GitHub Action cron job regenerates data and opens a PR. (This is the cleanest way to keep it fresh without a backend.)

### Runtime stack

- **Vite + React + TypeScript.**
- **MapLibre GL JS** for the map.
- **PMTiles + Protomaps** base style served from Cloudflare R2 or similar. One file, no tile server.
- **Tailwind** for styling.
- **shadcn/ui** for the component layer (side panel, toggles, sliders, popovers, dialogs). Install components as needed rather than upfront — keeps the bundle tight.
- **URL state** for filters (via `nuqs` or a small custom hook). Zustand only if URL state becomes awkward.
- **Recharts or visx** for the detail-panel frequency chart.

### Performance targets

- Initial JS < 300KB gzipped.
- Total data payload < 5MB, loaded progressively (routes first, stops on zoom-in, per-route detail on click).
- No layout shift after first paint.

### Deployment

**Cloudflare Pages**, static site. Setup:

- Connect the GitHub repo in the Cloudflare dashboard; pushes to `main` deploy automatically, PRs get preview URLs.
- Build command: `npm run build`
- Build output directory: `dist` (Vite default)
- Node version: pin to 20 via `.nvmrc` or the `NODE_VERSION` env var in Pages settings.
- Data files in `public/data/` are served as static assets alongside the built JS/CSS.
- PMTiles base map file: host on **Cloudflare R2** with public access and a custom domain. Metro Vancouver at z14 is 80–150MB — too large to bundle. R2 has no egress fees and serves HTTP range requests natively, which is exactly what PMTiles needs.
- Custom domain: set up in Pages dashboard, Cloudflare handles the DNS and TLS automatically if the domain is on their nameservers.
- Headers/redirects: use `public/_headers` and `public/_redirects` files (Netlify-style syntax, Cloudflare Pages supports them natively). Add long cache headers for `/data/*` since the data is content-hashed by the weekly cron.

## Styling

- Dark base map by default — colored routes pop much more. Light mode toggle available.
- Frequency bands use a perceptually uniform, colorblind-safe ramp (viridis-ish). Peak-only and night-only routes use a dashed treatment instead of a color on the ramp — *when* a route runs is on a different axis than *how often*.
- Ramp must survive desaturation to grayscale (portfolio screenshots often end up there).
- SkyTrain uses official line colors (Expo blue, Millennium yellow, Canada Line teal) to be instantly recognizable.
- One typeface (Inter).

## Attribution

Footer, always visible:

- "Transit data © TransLink" (linked to their open data page)
- "Map data © OpenStreetMap contributors"
- Link to the GitHub repo and the MIT license.

## Decisions

- **HandyDART:** excluded. Not fixed-route, not the audience.
- **NightBus:** its own band ("night only", dashed), not folded into the time-window filter.
- **Route variants:** separate in the data (per trip pattern), merged visually in the legend; detail panel shows them broken out.

## Open Questions

- Does TransLink's GTFS ship shape data for every route? If any are missing, fall back to a polyline along the stop sequence.
- Interlined trips (one vehicle, multiple `route_id`s) — GTFS handles these inconsistently. Audit once the feed is parsed; decide then whether to merge or leave them as separate routes.

## v2+ (explicitly punted)

- Compare two time snapshots ("2015 network vs. now").
- Population served within X min walk of the FTN (census overlay).
- Real-time layer toggle using the TransLink GTFS-RT feed.
- Embed mode and shareable map snapshots as images.
- Isochrone overlay for a clicked stop.

## License

MIT for the code. Data attributions as above. `LICENSE` file at repo root; `README.md` explains the data license chain.
