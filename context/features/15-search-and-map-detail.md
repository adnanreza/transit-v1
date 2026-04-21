# 15 — Search & Map Detail Enhancements

Two complaints surfaced by real use of the app:

1. **The search dropdown hides most of the network.** Open it with an empty
   query and you see routes 002…049 — and that's it. Routes 340, 701, R4, R5,
   R6 never appear until you type the right prefix, and even then you have to
   already know what you're looking for. The 99 B-Line is stored as `"099"`
   in GTFS, so it's findable (substring match), but the row label reads
   `"099"` instead of the `"99"` riders actually see on the bus.
2. **The map feels bare.** Street names don't render at useful zooms, stops
   only appear above z13, and the SkyTrain stations that riders recognize
   don't have labels. Click on a stop: nothing happens. There's no
   street-level grounding, so the network reads as floating ribbons.

This feature tightens both. Search becomes a real finder that surfaces the
whole network at a glance. The map gets pragmatic detail — street labels at
mid zooms, stops starting one zoom out, and a minimal stop-click popup that
names the stop and lists which routes serve it.

Route-data accuracy is verified against TransLink's published GTFS
(`gtfs-static.translink.ca/gtfs/google_transit.zip`, already the source for
this repo — see `scripts/build-data.ts:47`) and TransLink's public schedule
pages (`translink.ca/schedules-and-maps/…`). The 99 B-Line, all six RapidBus
corridors (R1 King George, R2 Marine-Willingdon, R3 Lougheed, R4 41st Ave,
R5 Hastings, R6 Scott Road), the 3xx South-of-Fraser network, and the 7xx
community shuttles are all active in the current feed and should be reachable
from the search UI on the first interaction.

## Acceptance Criteria

### Display short names as riders see them

- Add a pure helper `displayShortName(short: string): string` in
  `src/lib/route-search.ts` that strips leading zeros from all-numeric
  GTFS short names (`"099"` → `"99"`, `"004"` → `"4"`) and returns
  non-numeric names unchanged (`"R4"` → `"R4"`, `"N10"` → `"N10"`).
- Use it in `RouteSearch` row labels, `RouteDetailPanel` header, and the
  hover `RouteTooltip`. Anywhere we render `route_short_name` to the user,
  route it through the helper.
- **Do not** rewrite `route_id` or the underlying GeoJSON. The helper is a
  display transform only — search matching still operates on the raw
  GTFS short name.
- Tests cover: `"099"` → `"99"`, `"004"` → `"4"`, `"R4"` → `"R4"`,
  `"N10"` → `"N10"`, `""` → `""`, `"0"` → `"0"` (preserve a literal zero).

### Search — empty-state surfaces the whole network

- When the query is blank, the dropdown shows a curated, grouped list
  instead of the first 50 numeric routes:
  - **Rapid transit** (route_type ≠ 3): Expo Line, Millennium Line, Canada
    Line, SeaBus, WCE — in that order.
  - **RapidBus** (short name matches `/^R\d+$/`): R1, R2, R3, R4, R5, R6.
  - **Frequent buses** (routes whose frequencies band is `frequent` or
    `very_frequent` for weekday midday): ordered numerically.
  - **All other routes**: collapsed behind a "Show all N routes" footer
    row that, when clicked, expands the remaining routes in numeric order.
- Headings use the `text-xs font-medium text-neutral-900 dark:text-neutral-100`
  type style introduced by feature 14. Not uppercase tracking.

### Search — typed queries match smarter

- Keep the existing `matchRouteQuery` substring-prefix-on-normalized-string
  behavior for correctness.
- Extend `normalize()` to also strip leading zeros from all-digit tokens
  so `"99"` and `"099"` both match the 99 B-Line without us having to
  teach users about GTFS padding. (Add tests.)
- When the query is non-blank, drop the group headings and render a flat,
  ranked list:
  1. Short-name exact match (`"99"` → 99 B-Line first).
  2. Short-name prefix (`"34"` → 340, 341, 342, …).
  3. Long-name substring (`"ubc"` → every route touching UBC).
- Highlight the matched substring in each row using `<mark>` with the
  existing accent color so the match reason is visible at a glance.
- Raise the result cap from 50 to effectively unbounded; cmdk's
  `CommandList` already virtualizes its children, so the cost is bounded.
  If perf regresses on first-paint of a 237-row empty state, gate behind
  a `head(200)` and show "Keep typing to narrow" as the trailing row.

### Search — better input affordances

- Placeholder becomes `"Search — 99, R4, Main St, UBC"`. (Live examples
  present in the current feed; "99" renders as "99" because of
  `displayShortName`.)
- Retain `/` as the global open shortcut. Add `⌘K` / `Ctrl+K` as an
  alternative binding — standard command-palette UX and doesn't conflict
  with browser find.
- When the dialog opens, focus the input and pre-select any existing
  query text so a second `/` press behaves like "re-search".
- ESC closes (cmdk default — already works; just verify after the grouped
  rendering lands).

### Map — street labels at mid zoom

- Confirm Protomaps' default theme (`namedTheme('dark' | 'light')` in
  `src/lib/map-style.ts:32`) emits road labels. Recent `protomaps-themes-base`
  versions label roads from z11 upward; if our pinned version is older
  and doesn't, bump the dependency and verify.
- No custom label layers added by us. If Protomaps' defaults need tweaking
  (e.g. label density too low at z13), do it by overriding specific
  layer `minzoom` values post-`buildMapStyle`, not by forking the theme.
- Verify parity in both `dark` and `light` themes — labels must read in
  both without extra glyph fetches beyond the already-configured
  Protomaps glyph endpoint.

### Map — stops start one zoom earlier

- Drop `STOPS_LAYER` `minzoom` from 13 to 11 in `src/components/Map.tsx`.
- Extend the existing `stopCircleRadius` interpolation so stops start
  tiny at z11 (~0.75 px) and grow into the current z13 size (~1.5 px):
  - z11: 0.75
  - z13: 1.5
  - z15: 2.5
  - z17: 4
- Keep the circle color, stroke, and opacity unchanged. No clustering.
- Performance check: pan across Metro Vancouver at z11 — must stay at
  60 fps with all ~8.8k stops source-loaded. If frame time regresses,
  gate the z11–z12 range behind a `circle-opacity` interpolation that
  fades stops in rather than hard-showing them, so MapLibre can short-
  circuit fully-transparent paints.

### Map — click a stop, see what's there

- Clicking a stop dot opens a small popover (MapLibre `Popup`) anchored
  to the stop geometry. Content:
  - Stop name (from `stops.geojson` `properties.stop_name`).
  - Stop code if present (`properties.stop_code`) — TransLink posts
    these on bus-stop signs, riders text them to 33333 for times.
  - "Routes serving this stop" — a flat list of route badges for every
    route whose trips touch this `stop_id`. Clicking a badge closes the
    popup and opens `RouteDetailPanel` for that route (reuses existing
    `onRouteSelect`).
- Stop → route lookup requires a reverse index that doesn't exist yet.
  Build it in the data pipeline:
  - In `scripts/build-data.ts`, after stops + patterns are computed, emit
    `public/data/stop-routes.json` — a `Record<stop_id, route_id[]>`.
    Deduped, sorted by the same numeric-then-alpha rule as the search
    index. Size budget: ≤50 KB gz.
  - The map loads this JSON lazily on first stop-click, not at page
    load, so initial bundle is untouched.
- Hit-priority rule (continuation of feature 09): route-layer clicks
  still win when a route runs past a stop. Stops only become the click
  target when the cursor is directly on a stop circle and not inside
  a route-line hitbox. Implement with `queryRenderedFeatures` layer
  ordering — query the route layers first, fall back to `stops-circles`.
- On mobile (`<640px`), the popup's anchor logic must keep it on-screen
  when a stop is near the viewport edge; MapLibre's `Popup` handles this
  if we don't override `anchor`.

## Performance

- No new map sources beyond `stop-routes.json` (lazy-loaded on first
  stop-click). Initial JS bundle budget unchanged.
- `stop-routes.json` size target: ≤50 KB gz. Verify with the existing
  `npm run build` size check.
- Search dropdown empty-state: grouping adds ~1 ms of render cost for
  237 routes — within budget. If the "Show all" expansion regresses on
  low-end phones, virtualize with cmdk's built-in support.

## Out of Scope

- **Live next-bus times in the stop popup.** Requires a real-time API
  key, rate-limit handling, and a backend proxy. A future feature.
- **Directional stop pairs collapsed into one popup.** The two dots at
  a corner (westbound vs eastbound) stay separate; merging them needs
  a heuristic that can get wrong on one-way streets.
- **Route-shape stop highlighting.** Selecting a route doesn't bolden
  the stops along its shape in this feature. Interesting but adds a
  second filter and a second paint pass on the stops layer.
- **Fuzzy search / typo tolerance.** "hatsings" → Hastings is a
  real want, but full fuzzy matching balloons the search implementation.
  Prefix+substring is sufficient for the current dataset.
- **Search by landmark or address.** Requires a geocoder (Nominatim,
  Mapbox, etc.) and a separate result type. Defer.
- **Saved / recent routes.** No local storage in this feature. v2.
- **Stop clustering at low zoom.** The minzoom gate does the job.
- **Labels for stops on the map itself.** Text on a dense map needs
  collision detection and a symbol layer — same reason feature 09
  deferred it. A later polish pass.

## Depends On

- `02 Data Pipeline Foundation` — `stops.geojson` + pattern computation
  feed the new stop→route reverse index.
- `03 Frequency Computation` — the frequent-bus group in the search
  empty state reads from the existing `frequencies.json` bands.
- `08 Route Detail Panel` — stop-popup badge clicks reuse
  `onRouteSelect` to open the panel.
- `09 Stops Layer` — the circle layer we're tweaking and wiring a
  click handler onto.
- `14 Layout Overhaul` — inherits the typography conventions and
  sheet-coordination rules (stop popup closes when About / Route
  sheets open, and vice versa).

## Notes

- **Why `"099"` is in the data:** TransLink's GTFS pads numeric
  `route_short_name` to three digits for a stable lexicographic sort
  in spreadsheet tooling. Their public schedule pages show the
  unpadded value (`translink.ca/schedules-and-maps/route/99/...`).
  Riders universally say "the 99" — we should match that.
- **Why RapidBus gets its own empty-state group:** R1–R6 are the
  backbone of the post-2019 FTN rollout. Today they're buried below
  099 in the numeric sort, which buries the product TransLink most
  wants riders to know exists.
- **Why stops at z11 and not z10:** at z10 the whole of Metro
  Vancouver fits on screen and 8.8k dots is visual mud. z11 covers
  "Vancouver + Burnaby + North Shore" — a neighborhood-level view
  where stop density reads as network density instead of noise.
- **Why build `stop-routes.json` in the pipeline, not at runtime:**
  the reverse index needs `stop_times.txt` (~100 MB raw) to compute.
  We already read it in `scripts/build-data.ts` for headway
  computation, so adding a second output costs nothing. Doing this
  at runtime would reload megabytes of trip data into the browser.
- **Colorblind note:** the stop-popup route badges reuse the existing
  band palette from feature 05. No new colors enter the ramp.
- **Verification sources (TransLink):**
  - GTFS static feed: `https://gtfs-static.translink.ca/gtfs/google_transit.zip`
  - Developer page: `translink.ca/about-us/doing-business-with-translink/app-developer-resources/gtfs/gtfs-data`
  - 99 B-Line schedule: `translink.ca/schedules-and-maps/route/99`
  - RapidBus overview: `translink.ca/schedules-and-maps/rapidbus`
  - Frequent Transit Network definition: every 15 min or better in
    both directions, Mon–Fri 6am–9pm, Sat 7am–9pm, Sun/hol 8am–9pm
    (`translink.ca/plans-and-projects/projects/frequent-transit-network`).
- **Commit plan** (rough, increasing risk):
  1. `feat: displayShortName helper strips leading zeros for labels`
  2. `test: displayShortName preserves R-lines and handles edge cases`
  3. `feat: normalize leading zeros in search query matching`
  4. `feat: grouped empty-state in RouteSearch (Rapid / RapidBus / Frequent / All)`
  5. `feat: highlight matched substring in search result rows`
  6. `feat: show stops from z11 with a smaller dot radius`
  7. `feat: emit stop-routes.json reverse index in build-data pipeline`
  8. `feat: stop-click popup with routes-serving-this-stop chips`
  9. `feat: update placeholder copy and add ⌘K shortcut`
  10. `chore: bump protomaps-themes-base if street labels need newer version`
- **Manual verification:**
  - `/` → dialog opens → empty state shows Rapid transit, R1–R6,
    Frequent buses, collapsed tail — no typing required.
  - Type `99` → 99 B-Line is the top match, labeled "99" not "099".
  - Type `r4` → R4 41st Ave appears immediately; short name stays "R4".
  - Type `340` or `701` → exact match appears in the top slot.
  - Zoom to z11 over downtown → stops visible as tiny dots.
  - Click a stop → popup with stop name, code, and route badges.
  - Click a route badge in the popup → `RouteDetailPanel` opens for
    that route, popup closes.
  - Click a route line that runs past a stop → panel opens for the
    route, not the stop (hit priority preserved).
