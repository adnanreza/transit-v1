# 08 — Route Detail Panel + Hover Tooltip

Click a route, get everything interesting about it. Hover a route, get its number + current band. These two interactions close the "I see a yellow line, but which route is it actually?" gap that 05 / 06 left open, and they unlock the 24-hour frequency chart — the single visualization SPEC.md specifically calls for beyond the map itself.

## Acceptance Criteria

### Hover tooltip

- Hovering a route on the map (solid or dashed layer) highlights it (same pulse treatment as search select, but sustained, not fading) and shows a small tooltip near the cursor.
- Tooltip contents: `route_short_name` · `route_long_name` · current band label (derived from the live selection, e.g. `Frequent · ≤15 min`). Truncate long names with an ellipsis at ~28 chars.
- Tooltip follows the cursor within the route's geometry; disappears on `mouseleave`.
- Touch / no-hover devices skip the tooltip entirely; tap falls through to click.
- Hover highlight clears when a click opens the detail panel (panel selection takes over as the highlighted route).

### Click opens the detail panel

- Clicking a route feature opens a right-side **shadcn `Sheet`** with the route's details.
- Clicking another route while the panel is open swaps the content in place (no close-then-open flicker).
- Clicking empty map (not on a route feature) closes the panel.
- `Esc` also closes; focus returns to the map container.
- Panel is keyboard-reachable: clicking a route moves focus into the panel header; `Tab` navigates within; `Esc` closes.

### Panel contents (in order, top → bottom)

- **Header row:**
  - Large `route_short_name` badge, tinted with the route's current band color (or its GTFS `route_color` for rapid transit).
  - `route_long_name` below the badge.
  - Operator line (always "TransLink" for v1 — pull from GTFS `agency.txt` at build time via a new field, don't hard-code the string in the UI).
  - Close button (standard `Sheet` affordance).
- **FTN qualification:**
  - Large `✓ FTN-qualifying` or `✗ Not FTN-qualifying` indicator.
  - If `✗`, a one-line explanation naming the first failing `(day_type, hour)`: e.g. *"Weekday 6 AM headway is 25 min; FTN requires ≤15 min in every 06:00–21:00 hour across all three day types."*
- **24-hour frequency chart:**
  - Three small-multiples line charts stacked vertically: Weekday, Saturday, Sunday.
  - X axis: hour of day, fixed range 6–21 (the hours FTN is evaluated over — outside that the data is sparse / irrelevant to the FTN story).
  - Y axis: headway in minutes, inverted so more-frequent service visually rises (taller = better).
  - A horizontal reference line at 15 min (the FTN threshold).
  - A single chart per day type using the route's worst-major-pattern headway at each hour (the same rule that drives the map color).
  - Hovering a point shows the exact headway in a tooltip.
- **Termini:**
  - One line per major pattern (`trip_share >= 0.2`): `terminus_a ⇄ terminus_b`.
  - "Major" is the same definition as 03 / 05 / 06; pattern list order is by `trip_share` descending.
  - When a route has only one major pattern, render a single line; don't fake variety.
- **Minor patterns footnote** (small muted text):
  - "Also runs: N minor pattern variants" where N counts patterns with trip_share <0.2. Omit if N = 0.

### URL deep-link

- Selected route lives in the URL as `?route=<route_id>`.
- Initial `?route=<id>` at page load opens the panel and pans to the route's bbox (reuses the `FocusRequest` mechanism from 06).
- Closing the panel strips `?route=` via `clearOnDefault` (default is `null`).
- Unknown `route_id` → panel stays closed, warning logged via the same `useUrlStateCleanup` path from 07.

### Data pipeline additions

The current `frequencies.json` output from 03 doesn't carry the fields this feature needs. Extend the build script:

- **Operator (`agency_name`)** at the route level, read from GTFS `agency.txt` via `agency_id` on each row of `routes.txt`.
- **Termini per pattern** (`first_stop_name`, `last_stop_name`) — the display names of the first and last stops in the pattern's stop sequence. Requires a second pass over `trips.txt` + `stop_times.txt` + `stops.txt` during 03's build, keyed by the existing pattern hash.
- Shape of the new fields goes into `scripts/types/frequencies.ts` so the app and pipeline share the definitions (same pattern as 03).

No new files — the extra data folds into `frequencies.json`. Budget: the addition is bounded (~small string per pattern × a few hundred patterns).

### Other

- **Smooth transitions:** panel open/close animates via the standard `Sheet` transition. No layout shift on open (the sheet floats above the map).
- **Accessibility:** `Sheet` ships with `role="dialog"` and focus trap by default; add explicit `aria-label` / `aria-describedby` on the content. Chart points expose values via ARIA so a screen reader can read headway numbers without a mouse.
- **No light-mode special-casing** — dark-only is still the only theme until the light-mode feature lands.
- **Unit tests** (Vitest) for the pure logic added:
  - `hourlyChartSeries(route, day)` — builds the `{hour: number, headway: number | null}[]` for one day-type small-multiple, picking the worst-major-pattern headway at each hour (null when no major pattern has service that hour).
  - `formatFtnFailure(failure)` — renders the user-facing explanation string; exact fallback when `failure` is null.
  - `majorPatternsSorted(route)` — descending by trip_share, ties broken stably.
  - `countMinorPatterns(route)` — the footnote helper.

## Performance / Data Budget

- Panel + chart code must lazy-load. The existing Map chunk is already at 287 KB gz; adding Recharts or visx on top of the initial JS would blow SPEC's 300 KB budget. Use `React.lazy` on the panel itself (not just the chart) so first paint stays lean.
- `frequencies.json` gains termini + operator strings. Re-verify the file stays well under 500 KB gz after the rebuild.
- Charts render under 100 ms for a typical route. Three small multiples × ~16 hourly points = 48 data points total. Trivial.
- No new fetches. All the data for the panel lives in `frequencies.json` and `routes.geojson`.

## Out of Scope

- **Major intermediate stops** beyond the termini. Useful but needs either a manually curated list or a transfer-point heuristic, both of which merit their own feature. Leave for later.
- **Real-time arrivals** at the termini — SPEC v1 non-goal.
- **Light-mode styling** — still deferred to a theming feature.
- **Share-this-route button** with a copy-to-clipboard — nice, but `?route=` in the URL already does this. Skip the button unless user testing asks for it.
- **Highlight fade on panel open** — panel-driven highlight is sustained, not pulsed. The existing fading pulse stays scoped to search-select.

## Depends On

- `03 Frequency Computation` — the build script's output is what's getting extended. This feature needs to modify `scripts/build-data.ts` and `scripts/types/frequencies.ts`.
- `04 / 05 / 06 / 07` — map substrate, coloring, controls, and URL state are all load-bearing for the hover highlight + click handler + deep-link.

## Notes

- **Chart library:** prefer **Recharts** over visx for this feature. Small multiples in Recharts are ~15 LoC per panel; visx is more flexible but adds more boilerplate to a PR that's already doing a lot. Bundle-check after install — if Recharts pushes past budget even lazy-loaded, fall back to visx or a hand-rolled SVG.
- **Pattern → chart:** the chart uses the route's band-driving pattern at each hour, not any single pattern. That matches the map coloring semantics; a user who sees "frequent" on the map at a given hour sees the same number on the chart.
- **`useSelectedRoute` hook:** follow the 07 pattern — one hook per URL segment, wraps `useQueryState` with a validator that drops unknown route_ids. Lives in `src/lib/url-state.ts` alongside the others.
- **Hover highlight layer:** a second copy of the `routes-lines-selected` layer isn't necessary — reuse the existing overlay, but stop auto-fading while the panel is open or a hover target is held.
- **Commit plan** (suggested):
  - `feat: extend build-data with operator and pattern termini`
  - `chore: regenerate frequencies.json with operator + termini`
  - `feat: add useSelectedRoute URL hook and an app-level selected-route state`
  - `feat: scaffold RouteDetailPanel as a lazy-loaded shadcn Sheet`
  - `feat: wire route click to open the panel and empty-map click to close`
  - `feat: hover tooltip showing route number, name, and current band`
  - `feat: render route header (badge, long name, operator) and FTN qualification`
  - `feat: 24-hour frequency small-multiples chart with FTN threshold line`
  - `feat: termini list and minor-pattern footnote`
  - `test: unit tests for hourlyChartSeries and FTN failure formatter`
- **Colorblind verification:** the chart introduces new color usage (3 small multiples, the FTN threshold line). Verify each day-type line is distinguishable from the reference line in grayscale and a CB simulator before shipping.
