# Current Feature: 08 Route Detail Panel + Hover Tooltip

## Status

In Progress

## Goals

### Hover tooltip
- Hover a route → sustained white highlight (same layer as search pulse, not fading) + small near-cursor tooltip
- Tooltip: `route_short_name` · `route_long_name` · current band label (`Frequent · ≤15 min`); truncate long names at ~28 chars
- Tooltip tracks cursor; clears on mouseleave; skipped on touch / no-hover devices; hover highlight clears when panel opens

### Click opens detail panel
- Click a route → shadcn `Sheet` opens on the right
- Clicking another route swaps content in place, no close-then-open flicker
- Click empty map closes; `Esc` closes; focus returns to map
- Panel keyboard-reachable, focus trap via shadcn defaults

### Panel contents (top → bottom)
- Header: colored route badge, long name, operator line, close button
- FTN status: `✓ FTN-qualifying` or `✗` + explanation of first failing `(day_type, hour)` with the actual headway number
- 24-hour frequency chart: 3 stacked small-multiples (Weekday / Saturday / Sunday), x=6–21, y=headway (inverted so more-frequent = taller), 15-min reference line, point hover → exact headway
- Termini: `terminus_a ⇄ terminus_b` per major pattern (trip_share ≥ 0.2), sorted desc by trip_share
- Minor-pattern footnote: `Also runs: N minor pattern variants` (omit if N=0)

### URL deep-link
- `?route=<id>` opens the panel + pans to bbox on load (reuse `FocusRequest`)
- Close strips via `clearOnDefault`; unknown ids dropped + warned by `useUrlStateCleanup`

### Data pipeline
- Extend `scripts/build-data.ts` + `scripts/types/frequencies.ts`:
  - `agency_name` per route (from `agency.txt` via `agency_id` in `routes.txt`)
  - `first_stop_name` / `last_stop_name` per pattern (from `trips.txt` + `stop_times.txt` + `stops.txt`)
- `frequencies.json` stays well under 500 KB gz after rebuild

### Other
- Panel + chart lazy-loaded via `React.lazy` — keep initial JS < 300 KB gz
- Accessibility: `aria-label` / `aria-describedby` on panel; chart points announce values
- Unit tests:
  - `hourlyChartSeries(route, day)` — worst-major-pattern headway per hour, null when no major service
  - `formatFtnFailure(failure)` — user-facing explanation string; handles null
  - `majorPatternsSorted(route)` — stable desc sort by trip_share
  - `countMinorPatterns(route)` — footnote helper
- Manual verification: colorblind simulator + grayscale on the chart's 3 series + reference line

## Notes

- Depends on: **03** (pipeline owned there), **04** / **05** / **06** / **07** (all merged)
- Chart lib: **Recharts** default; fallback to visx or hand-rolled SVG if bundle blows past budget even lazy-loaded
- `useSelectedRoute` hook lives in `src/lib/url-state.ts` alongside the others — same 07 pattern
- Hover highlight reuses the `routes-lines-selected` layer from 06; just stop auto-fading while hovered / panel open
- Out of scope: major intermediate stops (heuristics/curation for a later feature), real-time arrivals, light-mode, share button (URL already does it), highlight-fade on panel open (stays sustained)
- Commit plan from spec:
  1. `feat: extend build-data with operator and pattern termini`
  2. `chore: regenerate frequencies.json with operator + termini`
  3. `feat: add useSelectedRoute URL hook and an app-level selected-route state`
  4. `feat: scaffold RouteDetailPanel as a lazy-loaded shadcn Sheet`
  5. `feat: wire route click to open the panel and empty-map click to close`
  6. `feat: hover tooltip showing route number, name, and current band`
  7. `feat: render route header (badge, long name, operator) and FTN qualification`
  8. `feat: 24-hour frequency small-multiples chart with FTN threshold line`
  9. `feat: termini list and minor-pattern footnote`
  10. `test: unit tests for hourlyChartSeries and FTN failure formatter`

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
- 2026-04-17 — 05 Frequency Coloring ([PR #5](https://github.com/adnanreza/transit-v1/pull/5))
- 2026-04-17 — 06 Controls ([PR #6](https://github.com/adnanreza/transit-v1/pull/6))
- 2026-04-17 — 07 URL State ([PR #7](https://github.com/adnanreza/transit-v1/pull/7))
