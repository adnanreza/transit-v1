# Current Feature: 05 Frequency Coloring

## Status

In Progress

## Goals

- Load `public/data/frequencies.json` on mount (no spinner)
- Color **bus routes** (`route_type = '3'`) by frequency band at the currently selected (day_type, time_window); rapid transit (`1, 2, 4`) keeps its GTFS `route_color` from 04
- Implement the SPEC-aligned frequency ramp (`very_frequent` ≤10 / `frequent` ≤15 / `standard` ≤30 / `infrequent` >30) using a perceptually-uniform, colorblind-safe, grayscale-surviving palette — ship real hex values, not placeholders
- Render `peak_only` and `night_only` with a visible `line-dasharray` in their band color (distinct "when" axis, not extra ramp slots)
- Grey out / semi-transparent for routes with no service in the selected window
- Split the routes paint into `routes-lines-solid` and `routes-lines-dashed` layers with mutually-exclusive filters; preserve 04's `line-sort-key` ordering (rapid transit on top)
- Join `frequencies.json` to features via a runtime `['match', ['get', 'route_id'], …]` expression; fall back to precomputing into `routes.geojson` only if expression performance is visibly bad
- Day-type toggle (Weekday / Saturday / Sunday), single-select, shadcn component
- Time-window toggle (All day / AM peak / Midday / PM peak / Evening / Late night), single-select
- Controls in a floating card that doesn't fight the map or the attribution footer
- Always-visible static legend matching the band colors + dashed treatment; note rapid transit uses line colors
- Smooth repaint on toggle changes via `setPaintProperty`, not a style rebuild; target <100 ms
- Unit tests for `routeBandAt(route, day_type, time_window)` covering peak/night overrides, worst-major-pattern rule at a window, and missing-headway handling
- Manual verification in the PR body: colorblind simulator (deuteranopia/protanopia/tritanopia), grayscale desaturation, toggle snappiness

## Notes

- Depends on: **03** (`frequencies.json` — merged) and **04** (map skeleton — merged)
- Default state: Weekday + All day
- Perf: initial JS stays <300 KB gz; control components fold into the lazy Map chunk; repaint <100 ms per toggle
- Out of scope (deferred): threshold slider, mode filter, search, URL state, route detail panel, hover tooltip
- Commit plan from spec:
  1. `feat: load frequencies.json and expose via a useFrequencies hook`
  2. `feat: add routeBandAt helper and unit tests`
  3. `feat: split route rendering into solid + dashed layers`
  4. `feat: apply band-driven line-color to bus routes`
  5. `feat: day-type and time-window toggle controls`
  6. `feat: static legend`
  7. `refactor: move control + legend positioning to not fight map attribution`

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
