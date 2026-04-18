# 09 — Stops Layer

Show stops on the map so the geography has physical anchor points — "there's a stop on this corner", "this route serves this station". Right now the map's only overlay is the route lines, and at city-wide zoom that reads as abstract ribbons with no street-level grounding. Per SPEC's map requirements: *"Stops shown at a zoom level where they don't clutter."* This feature closes that gap.

Keep it deliberately minimal. v1 is **purely decorative** — stops are dots, not interactive. Click / hover on a stop, popovers listing routes serving it, stop-name labels, and per-mode / per-day visibility are all out of scope and deferred to their own features. Adding interaction now would either collide with the route-hover tooltip (hit priority) or bleed into a bigger stop-detail feature.

## Acceptance Criteria

### Rendering

- Stops render as small filled circles on the map, above the base map and **below** the route lines (so hovering or clicking a route near a stop still dispatches on the route).
- Visible only when the map is zoomed in enough for stops to be useful: `minzoom ≥ 13`. Below that, stops are hidden entirely (the map stays legible as a network overview).
- Circle radius scales with zoom via a `['interpolate', ['linear'], ['zoom'], …]` expression:
  - z13: ~1.5 px
  - z15: ~2.5 px
  - z17: ~4 px
- Color: a single muted off-white (`#d4d4d4` or similar) that reads on the dark base map without competing with the colored routes. A 1 px dark stroke (the same tone as the base map water/land boundary) gives the dot definition against light route-color backgrounds (e.g. yellow `very_frequent` lines).
- Opacity: ~0.85 — enough to feel solid, not loud.

### Data

- The existing `public/data/stops.geojson` already carries the right set of stops (parented `location_type=0` / empty, filtered to finite lat/lon in 02). Consume it as-is. No pipeline changes.
- Don't attempt to filter stops by mode or by "only stops on a route in the current filter" — that's expensive to compute at interact time and conflates two axes (stops are about geography, the mode filter is about what routes render).
- Stops on rail-only platforms are already dropped by the `parseStops` filter (`location_type === '1'` drops stations). SkyTrain station *stops* (the z=0 platform entries, not the parent station) do come through. That's fine — it matches the network view SkyTrain riders have.

### Interaction

- **No hover tooltip, no click handler on stops in v1.** Purely visual.
- Route-layer click + hover-tooltip behavior from 08 is unchanged — stops sit below routes in the layer stack so `queryRenderedFeatures` on `click` / `mousemove` still returns the route feature first when a user targets a route that runs near a stop.
- Mode filter does NOT hide stops. Stops are mode-agnostic; a SkyTrain-station dot on Cambie is useful even when only buses are filtered on.

### Performance

- Single `geojson` source + one `circle` layer. MapLibre handles ~9k stops as a non-clustered source fine at our zoom range, but render cost matters — confirm 60 fps pan at z14 after this lands.
- Lazy-loaded with the map (the Map chunk already is). No impact on the initial JS bundle.
- Data budget: `stops.geojson` is ~191 KB gz today. This feature doesn't change that number (no new fields written).

### Accessibility

- Stops are not part of the interactive story in v1, so no ARIA wiring is needed. If / when they become clickable (future feature), that's where screen-reader labels live.

## Out of Scope

- **Stop name tooltip on hover** — would conflict with the route-hover tooltip from 08 (route-vs-stop hit priority, tooltip overlap). Merits its own UX pass.
- **Click-a-stop for "routes serving this stop"** — would need the stop→pattern→route lookup wired through the data pipeline (stop_times.txt only gives us sequences, not the reverse index). A future "stop detail" feature can add that.
- **Stop name labels on the map** — text on a dense map needs collision detection and symbol layers, not just circles. A later polish pass.
- **Station consolidation** (e.g. merging the two directional bus-stop dots at a SkyTrain entrance into one) — heuristic-heavy; skip.
- **Mode-filtering stops** — stops are geographic, mode filter is behavioral. Mixing them muddies the mental model.
- **Clustering at low zoom** — the `minzoom: 13` gate already handles overview clutter; clustering adds a layer type and a feature pass we don't need.

## Depends On

- `02 Data Pipeline Foundation` — `public/data/stops.geojson` is already emitted. This feature consumes it without modification.
- `04 Map Skeleton` — layer model, source loading pattern, z-index ordering.
- `08 Route Detail Panel + Hover Tooltip` — establishes the layer-order convention (routes on top for hover / click priority); this feature respects it by placing the stops layer below.

## Notes

- **Circle color choice:** `#d4d4d4` (Tailwind `neutral-300`) at `fill-opacity: 0.85` reads clearly on the dark base map and doesn't add a color into the colorblind-safe route ramp. Avoid pure white — too loud against nearby yellow / teal lines. A 1 px stroke in `#0a0a0a` (Tailwind `neutral-950`) keeps the dot legible when it sits on top of a light route color at crossings.
- **Layer insertion point:** add the stops layer between the base-map symbol layers and the `routes-lines-*` layers so:
  1. Stops sit above water / land / roads (they're transit features, not base-map clutter).
  2. Routes sit above stops (so route-hover hit priority wins at crossings).
  3. The existing `routes-lines-selected` highlight overlay stays on top of everything.
- **Stop count:** current `stops.geojson` has ~8.8k features. At `minzoom: 13`, only a few hundred are ever in view at once, so the render cost is bounded. Verify by panning across downtown at z14 — should stay at 60 fps.
- **Layer ID:** `stops-circles`. Keep to the naming convention (`<layer-kind>-<geometry-or-variant>`) used by the existing `routes-lines-*`.
- **No mode filter wiring:** skip threading `enabledModes` through the stops layer entirely. If future UX testing reveals that SkyTrain-only riders want stops hidden in bus-only mode, that's a new feature, not a bolt-on.
- **Commit plan** (suggested):
  1. `feat: add stops GeoJSON source and circle layer to the map`
  2. `feat: scale stop-circle size with zoom and gate below z13`
  3. `chore: verify stops layer sits below routes in the layer stack`
- **Manual verification:** pan across downtown at z14 → expect stops visible without lag. Pan out to z11 → stops disappear. Hover a route that passes near a stop → route tooltip appears (stop shouldn't steal the hover). Click a route near a stop → panel opens for the route, not the stop.
- **Colorblind note:** the chosen off-white + dark-stroke combo is chromatically neutral — survives grayscale and any CB simulator unchanged. No new color enters the ramp.
