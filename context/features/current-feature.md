# Current Feature: 15 Search & Map Detail Enhancements

## Status

Complete

## Goals

### Display short names as riders see them

- [x] Add pure helper `displayShortName(short)` in `src/lib/route-search.ts` — strips leading zeros from all-numeric GTFS short names (`"099"` → `"99"`, `"004"` → `"4"`), returns non-numeric names unchanged (`"R4"`, `"N10"`).
- [x] Route all user-facing `route_short_name` renders through the helper: `RouteSearch` rows, `RouteDetailPanel` header, `RouteTooltip`.
- [x] Do not mutate `route_id` or the underlying GeoJSON — display transform only; matching still operates on raw GTFS short name.
- [x] Unit tests: `"099"` → `"99"`, `"004"` → `"4"`, `"R4"` → `"R4"`, `"N10"` → `"N10"`, `""` → `""`, `"0"` → `"0"`.

### Search — empty-state surfaces the whole network

- [x] Empty-query dropdown renders curated, grouped list (not the first 50 numeric routes):
  - Rapid transit (route_type ≠ 3): Expo, Millennium, Canada Line, SeaBus, WCE — in that order.
  - RapidBus (`/^R\d+$/`): R1, R2, R3, R4, R5, R6.
  - Frequent buses (weekday-midday band is `frequent` or `very_frequent`), numerically ordered.
  - "Show all N routes" footer expands the remaining routes in numeric order.
- [x] Group headings use `text-xs font-medium text-neutral-900 dark:text-neutral-100` (feature-14 convention, not uppercase tracking).

### Search — typed queries match smarter

- [x] Keep existing `matchRouteQuery` substring-prefix-on-normalized behavior.
- [x] Extend `normalize()` to strip leading zeros from all-digit tokens so `"99"` and `"099"` both match the 99 B-Line. Add tests.
- [x] Non-blank query renders a flat, ranked list (no group headings): (1) short-name exact match, (2) short-name prefix, (3) long-name substring.
- [x] Highlight matched substring in each row with `<mark>` using existing accent color.
- [x] Raise result cap from 50 to effectively unbounded (cmdk `CommandList` virtualizes). If first-paint regresses on 237-row empty state, cap at 200 and show "Keep typing to narrow" trailing row.

### Search — better input affordances

- [x] Placeholder: `"Search — 99, R4, Main St, UBC"`.
- [x] Retain `/` shortcut; add `⌘K` / `Ctrl+K` alternative.
- [x] Dialog open focuses input and pre-selects any existing query text (second `/` acts as re-search).
- [x] ESC closes (cmdk default) — verify after grouped rendering lands.

### Map — street labels at mid zoom

- [x] Confirm Protomaps' `namedTheme('dark'|'light')` emits road labels from z11+ in `src/lib/map-style.ts`. Bump `protomaps-themes-base` if the pinned version doesn't.
- [x] No custom label layers. If tweaks needed, override specific layer `minzoom` values post-`buildMapStyle` — don't fork the theme.
- [x] Parity in dark and light themes; labels must read in both without extra glyph fetches beyond the existing Protomaps glyph endpoint.

### Map — stops start one zoom earlier

- [x] Drop `STOPS_LAYER` `minzoom` from 13 to 11 in `src/components/Map.tsx`.
- [x] Extend `stopCircleRadius` interpolation: z11: 0.75 → z13: 1.5 → z15: 2.5 → z17: 4.
- [x] Keep circle color, stroke, opacity unchanged. No clustering.
- [x] 60 fps pan check at z11 across Metro Vancouver with all ~8.8k stops source-loaded. If regressed, fade z11–z12 in with `circle-opacity` interpolation so MapLibre can short-circuit fully-transparent paints.

### Map — click a stop, see what's there

- [x] Stop-dot click opens MapLibre `Popup` anchored to geometry. Content:
  - Stop name (`properties.stop_name`).
  - Stop code (`properties.stop_code`) when present.
  - "Routes serving this stop" — route-badge chips for every route touching this `stop_id`. Badge click closes popup and opens `RouteDetailPanel` via existing `onRouteSelect`.
- [x] Build stop→route reverse index in the pipeline:
  - `scripts/build-data.ts` emits `public/data/stop-routes.json` — `Record<stop_id, route_id[]>`, deduped, sorted numeric-then-alpha. ≤50 KB gz.
  - Map loads this JSON lazily on first stop-click, not at page load.
- [x] Hit priority preserved (feature 09): `queryRenderedFeatures` queries route layers first, falls back to `stops-circles`. Stops only become click target when cursor is directly on a stop circle and outside any route-line hitbox.
- [x] Mobile (`<640px`): let MapLibre's default `Popup` anchor logic keep the popup on-screen near viewport edges (don't override `anchor`).

## Notes

### Performance

- No new map sources beyond `stop-routes.json` (lazy-loaded on first stop-click). Initial JS bundle budget unchanged.
- `stop-routes.json` size target ≤50 KB gz. Verify with existing `npm run build` size check.
- Empty-state grouping adds ~1 ms of render cost for 237 routes — within budget. Virtualize with cmdk built-ins if "Show all" expansion regresses on low-end phones.

### Depends On

All prerequisite features are complete (see History):

- `02 Data Pipeline Foundation` — `stops.geojson` + patterns feed the new reverse index.
- `03 Frequency Computation` — frequent-bus empty-state group reads from existing `frequencies.json` bands.
- `08 Route Detail Panel` — stop-popup badge click reuses `onRouteSelect`.
- `09 Stops Layer` — the circle layer we're tweaking + wiring a click handler onto.
- `14 Layout Overhaul` — typography conventions + sheet-coordination rules (stop popup must close when About / Route sheets open).

### Key constraints from SPEC.md

- Zero runtime API calls. All data processed at build time. The new `stop-routes.json` must be emitted by `scripts/build-data.ts`, not fetched live.
- TransLink + OSM attribution preserved (feature 14 already routes OSM credit through the footer; nothing in 15 should re-enable MapLibre's default attribution).
- Stops-and-routes display must remain legible in both dark and light themes.

### Out of Scope (explicit)

- Live next-bus times, directional stop-pair merging, route-shape stop highlighting, fuzzy search, landmark/address geocoder, saved/recent routes, stop clustering, on-map stop labels.

### Verification sources (TransLink, cited in spec)

- GTFS: `gtfs-static.translink.ca/gtfs/google_transit.zip` (already the source in `scripts/build-data.ts:47`).
- 99 B-Line: `translink.ca/schedules-and-maps/route/99`.
- RapidBus (R1–R6 active): `translink.ca/schedules-and-maps/rapidbus`.
- FTN definition: every 15 min or better, both directions, Mon–Fri 6am–9pm, Sat 7am–9pm, Sun/hol 8am–9pm.

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
- 2026-04-18 — 11 Weekly GTFS Data Refresh Cron ([PR #12](https://github.com/adnanreza/transit-v1/pull/12))
- 2026-04-18 — 12 Light Mode ([PR #14](https://github.com/adnanreza/transit-v1/pull/14))
- 2026-04-20 — 13 + 14 UX Overhaul (onboarding, copy, layout, rapid transit casing) ([PR #16](https://github.com/adnanreza/transit-v1/pull/16))
