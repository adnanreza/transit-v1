# Current Feature: 07 URL State

## Status

In Progress

## Goals

- Serialize day_type, time_window, mode filter, thresholds, and map view (center + zoom) into the query string
- Deserialize on initial render — map paints the requested state directly, never flashes defaults first
- Default-omission: every key absent from the URL when state matches SPEC defaults (weekday / all_day / all modes / 10-15-30 / Metro Van center at z10)
- URL schema: `d`, `w`, `m=bus,seabus,...` (sorted), `t=10,15,30`, `c=lon,lat`, `z`
- Replace semantics for continuous controls (slider drag, pan/zoom); push for discrete ones (day toggle, mode click). Lean replace by default
- Invalid input tolerated: bad mode names / out-of-range thresholds / non-monotonic thresholds / garbage day strings fall back to defaults with one console warn
- Implementation: `nuqs` library, one hook per URL segment (`useDayType`, `useTimeWindow`, `useModeFilter`, `useThresholds`, `useMapView`) replacing App.tsx's `useState` calls 1:1
- Map view sync: `moveend` writes URL; URL change from elsewhere eases to the new view but only if drift > 1 m center / 0.01 zoom (prevents feedback loops)
- Unit tests for parse/serialize round-trip per segment + default-omission + malformed-input tolerance
- Manual verification: zoom/pan somewhere, copy URL, paste into new tab — map opens to same place, no Metro Van flash

## Notes

- Depends on: **05** (merged) and **06** (merged)
- Perf: initial JS stays <300 KB gz (audit `nuqs` add); no new data fetches
- URL keys short but readable (`d` / `w` / `m` / `t` / `c` / `z`), not single-char abbrev
- Center/zoom precision: 4 decimal places on write (~11 m) to keep URLs compact
- Fallback plan if `nuqs` blows bundle budget: hand-rolled `URLSearchParams` + `history.replaceState` hook
- Out of scope: search query / focus request in URL, hash routing, custom undo stack, route deep-links (those couple with detail panel → 08)
- Commit plan from spec:
  1. `feat: install nuqs and wire the NuqsAdapter at the app root`
  2. `feat: serialize day-type and time-window into the URL`
  3. `feat: serialize the mode filter as a comma-joined list`
  4. `feat: serialize frequency thresholds as a monotonic triple`
  5. `feat: persist map center and zoom with replaceState on moveend`
  6. `test: round-trip parsers for each URL segment and reject malformed input`

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
- 2026-04-17 — 05 Frequency Coloring ([PR #5](https://github.com/adnanreza/transit-v1/pull/5))
- 2026-04-17 — 06 Controls ([PR #6](https://github.com/adnanreza/transit-v1/pull/6))
