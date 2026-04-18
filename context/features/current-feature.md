# Current Feature: 06 Controls

## Status

In Progress

## Goals

### Mode filter
- Multi-select mode filter (Bus / SkyTrain / SeaBus / WCE); default all enabled
- Hide/show via `setFilter` composed with existing peak/night layer filters under an `all` combinator
- Component: shadcn `ToggleGroup type="multiple"` to match the day/window controls

### Frequency threshold slider
- Three handles: `very_frequent_max`, `frequent_max`, `standard_max`; `infrequent` = above standard
- Enforce monotonic ordering (clamp when a handle crosses a neighbor); 1–60 min, 1-min steps; defaults 10 / 15 / 30
- Map recolors live on drag (rAF-throttle if needed); <100 ms repaint on release
- FTN (`ftn_qualifies` flag) stays pinned at 15 min — canonical definition, not a user preference; legend calls this out
- Peak-only / night-only untouched by the slider

### Route search
- Shadcn `Command` palette with keyboard nav (arrows + enter); `/` keyboard shortcut to focus
- Route-number queries (`99`, `b-line`) — prefix/exact/case-insensitive match; select → `easeTo` route bbox + ~1.5s highlight fade
- Neighborhood search is a stretch: prefer a static `src/data/neighborhoods.json` of ~30 centroids; Nominatim only if we want an external-API demo
- Placement: top-left card (not in the attribution footer)

### Across the feature
- Legend goes dynamic — band labels reflect current threshold values; rapid-transit note persists
- All controls smooth-repaint (`setFilter` / `setPaintProperty` / `easeTo`) — never a style rebuild
- Accessibility: keyboard-reachable, aria labels, sliders announce value, command palette screen-reader-friendly
- Unit tests:
  - `routeBandAt(route, day, window, thresholds)` with custom thresholds (reclassification + peak/night override)
  - `matchesModeFilter(route_type, enabledModes)` predicate across bus/rapid/ferry × enabled/disabled
  - Route-number query matching (prefix / exact / case-insensitive / `b-line` aliases)

## Notes

- Depends on: **03**, **04**, **05** (all merged)
- Perf: initial JS stays <300 KB gz; audit `cmdk` bundle impact and lazy-load the command palette if needed; threshold slider drag must repaint at interactive rates
- Out of scope (deferred): URL state → 07; route hover / detail panel → later; stops rendering; light-mode toggle
- Refactor plan:
  - `routeBandAt` + palette expressions accept optional `thresholds?: { very_frequent; frequent; standard }` param defaulting to SPEC values (10/15/30); threaded from UI state through expression builders (no context/global)
  - Mode filter composes with layer filters via `['all', existingPeakFilter, modeFilter]`
- Commit plan from spec:
  1. `refactor: parameterize routeBandAt and palette expressions with user thresholds`
  2. `test: add unit tests for thresholded band derivation`
  3. `feat: mode filter (bus/skytrain/seabus/wce) with live layer filters`
  4. `feat: frequency threshold slider with monotonic enforcement`
  5. `feat: dynamic legend that reflects current threshold values`
  6. `feat: route-number search via shadcn command palette with easeTo highlight`
  7. `feat: add neighborhood search backed by a static list` *(stretch — skip if it grows past one commit)*
- Stretch call-out: if PR grows dense, neighborhood search is the natural cut to a follow-up

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
- 2026-04-17 — 05 Frequency Coloring ([PR #5](https://github.com/adnanreza/transit-v1/pull/5))
