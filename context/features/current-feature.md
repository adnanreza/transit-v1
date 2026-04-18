# Current Feature: 09 Stops Layer

## Status

In Progress

## Goals

### Rendering
- Render stops as small filled circles above the base map and **below** the route lines (route hit priority preserved)
- Gate with `minzoom ≥ 13` — hidden at network-overview zooms
- Zoom-scaled radius via `interpolate`: z13 ≈1.5px, z15 ≈2.5px, z17 ≈4px
- Color: muted off-white (`#d4d4d4`) + 1 px dark stroke (`#0a0a0a`) + ~0.85 opacity
- Layer id: `stops-circles` (follows `<kind>-<geom>` convention)

### Data
- Consume existing `public/data/stops.geojson` as-is — no pipeline changes
- Don't filter stops by mode or by "only stops on a route in the current filter"
- SkyTrain station *stops* (platform entries) are fine; `parseStops` already drops parent stations (`location_type='1'`)

### Interaction
- **No hover tooltip, no click handler on stops in v1** — purely visual
- Route-hover / route-click behavior from 08 is unchanged (stops under routes in layer stack)
- Mode filter does NOT hide stops

### Performance
- Single `geojson` source + one `circle` layer; no clustering
- Confirm 60 fps pan at z14 across downtown after landing
- Lazy-loaded with the existing Map chunk — no initial-JS delta
- `stops.geojson` stays ~191 KB gz (no new fields)

### Accessibility
- No ARIA wiring in v1 (non-interactive); revisit when clickability lands

## Notes

- Depends on: **02** (data already emitted), **04** (map substrate), **08** (layer-order convention — routes on top for hover/click priority)
- Layer insertion: stops sit between base-map symbol layers and `routes-lines-*`; `routes-lines-selected` stays on top of everything
- Stop count ~8.8k total in `stops.geojson`, only a few hundred visible at z≥13 — render cost bounded
- Chromatically neutral palette — survives grayscale + CB simulator unchanged; no new ramp color introduced
- Commit plan from spec:
  1. `feat: add stops GeoJSON source and circle layer to the map`
  2. `feat: scale stop-circle size with zoom and gate below z13`
  3. `chore: verify stops layer sits below routes in the layer stack`
- Out of scope: stop-hover tooltip, stop-click "routes serving this stop", stop-name labels, station consolidation, mode-filtering stops, clustering
- Manual verification: pan downtown at z14 → stops visible no lag; z11 → stops hidden; hover route near stop → route tooltip wins; click route near stop → panel opens for route

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
- 2026-04-17 — 04 Map Skeleton ([PR #4](https://github.com/adnanreza/transit-v1/pull/4))
- 2026-04-17 — 05 Frequency Coloring ([PR #5](https://github.com/adnanreza/transit-v1/pull/5))
- 2026-04-17 — 06 Controls ([PR #6](https://github.com/adnanreza/transit-v1/pull/6))
- 2026-04-17 — 07 URL State ([PR #7](https://github.com/adnanreza/transit-v1/pull/7))
- 2026-04-17 — 08 Route Detail Panel + Hover Tooltip ([PR #8](https://github.com/adnanreza/transit-v1/pull/8))
