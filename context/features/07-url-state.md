# 07 — URL State

Every filter the user can change should live in the URL, so a permalink restores the same map. SPEC.md's headline pitch — "shareable permalinks out of the box" — sits entirely in this feature. Small surface, high payoff for portfolio screenshots and bug repros alike.

## Acceptance Criteria

- **Day type**, **time window**, **mode filter**, and **frequency thresholds** all serialize into the query string and deserialize back on initial render.
- **Map view state** (center + zoom) also serializes. Shareable permalinks are nearly useless without this — the whole point of sending a link is to say "look at *this* place on *this* network state."
- **Default-omission:** when state matches SPEC defaults (weekday / all_day / all modes / 10-15-30 / Metro Van center at z10), those keys are absent from the URL. A user who hasn't touched anything sees a clean `/` URL, not a paragraph of params.
- **URL keys are short but readable** — `d` (day), `w` (window), `m` (modes), `t` (thresholds), `c` (center), `z` (zoom). Explicitly *not* abbreviating to single characters when the key is already short (`day` would bloat long URLs; `d` is fine given the full spec of values lives in the app).
- **Modes** encode as a comma-separated list, alphabetically ordered for stable URLs: `m=bus,seabus,skytrain,wce`. When all four are enabled (the default), the param is omitted entirely.
- **Thresholds** encode as a compact `t=10,15,30` triple. Validation enforces monotonic order and the 1–60 range; invalid values fall back to defaults.
- **Center/zoom** write as `c=-123.05,49.25&z=10` (lon,lat to match MapLibre's order). Truncate to 4 decimal places on write — ~11m precision is plenty and keeps URLs compact.
- **Browser back/forward** navigates between states. Pushing a new state on every control change would pollute history; **use replace semantics** for continuous controls (slider drag, pan/zoom) and push for discrete actions (toggling day type, selecting a mode). Exact choice is a judgment call — lean replace by default.
- **Initial URL → state** happens *before* the first paint. The map should render with the permalink-requested state directly; never flash defaults and re-render.
- **Invalid input is tolerated**, not fatal. Malformed params fall back to their default and the URL is silently corrected after mount. One console warning per invalid param is fine; don't spam.
- **Unit tests** (Vitest) for the parse/serialize helpers:
  - Round-trip each state piece: `parse(serialize(state)) === state`.
  - Defaults round-trip to an *empty* param map (default-omission works).
  - Malformed inputs (bad mode name, threshold out of range, non-monotonic thresholds, garbage day string) fall back to defaults without throwing.

## Implementation

- **Library: `nuqs`.** SPEC explicitly calls it out, it handles parsing/serializing with typed schemas and plays well with React, and we get back/forward navigation free. Adds a small bundle cost — audit in the build step.
- **Avoid Zustand.** SPEC says it's only warranted if URL state gets awkward; the five controls here are not awkward.
- **One hook per concern.** Rather than a single `useAppState` megahook, keep one hook per URL segment (`useDayType`, `useTimeWindow`, `useModeFilter`, `useThresholds`, `useMapView`). Each is a thin wrapper over `useQueryState` that also applies defaults + validation. App.tsx's existing `useState` calls get replaced one-for-one.
- **Map view sync** is slightly different: the Map holds the authoritative view after init. On `moveend`, it should write the URL; on URL change from elsewhere (user edits, back button), the Map should `easeTo` — but only if the URL-driven value diverges materially from the current view, to avoid feedback loops. Suggested threshold: >1 m center drift or >0.01 zoom drift.

## Performance / Data Budget

- Initial JS stays under SPEC's 300 KB gz cap. `nuqs` is small but verify after install.
- No new data fetches; URL state is purely local.
- URL updates themselves are cheap — `replaceState` / `pushState` are synchronous and don't trigger a re-render by themselves. React renders when the hook reports a new value.

## Out of Scope

- **Search query** or **focus request** in the URL. Transient; permalinks shouldn't auto-open a dialog or auto-pan. Deep-linking to a specific route (`?route=99`) is its own future feature — couple it with the detail panel feature (08) so the link opens the panel too.
- **History-based undo** of control changes beyond what the browser gives us. No custom undo stack.
- **Hash-based routing.** Query params are the convention for filter state; hash is for SPA routes, and we have none.

## Depends On

- `05 Frequency Coloring` (merged) — introduced day_type and time_window state.
- `06 Controls` (merged) — introduced mode filter, thresholds, and the controls that write into them.

## Notes

- **Permalink examples** (help reviewers picture the payoff):
  - Default: `example.com/`
  - Sunday evening Bus + SkyTrain only: `example.com/?d=sunday&w=evening&m=bus,skytrain`
  - 8-min "very frequent" cap at the Broadway corridor: `example.com/?t=8,15,30&c=-123.09,49.263&z=12`
- **Map view test:** after wiring up, open the app → zoom/pan around → copy the URL → paste into a new tab → map should open to the same place. Second tab should *not* flash through Metro Van default first.
- **Bundle watch:** if `nuqs` plus its required `next/navigation` shim pushes initial JS past the budget, drop to a small hand-rolled hook using `URLSearchParams` + `history.replaceState`. The full `nuqs` feature set (shallow routing, parallel updates, history modes) is nice-to-have, not load-bearing.
- **Commit plan** (suggested):
  - `feat: install nuqs and wire the NuqsAdapter at the app root`
  - `feat: serialize day-type and time-window into the URL`
  - `feat: serialize the mode filter as a comma-joined list`
  - `feat: serialize frequency thresholds as a monotonic triple`
  - `feat: persist map center and zoom with replaceState on moveend`
  - `test: round-trip parsers for each URL segment and reject malformed input`
