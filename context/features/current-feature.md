# Current Feature: 04 Map Skeleton

## Status

In Progress

## Goals

- Replace the placeholder page with a full-screen MapLibre GL map centered on Metro Vancouver
- Protomaps PMTiles base map via the `pmtiles` package's MapLibre protocol handler; URL configurable via `VITE_PMTILES_URL`
- Dark Protomaps base style (SPEC: colored routes pop on dark)
- Load `public/data/routes.geojson` and render lines colored by each feature's `route_color`
- Mode-distinct line widths: SkyTrain / SeaBus / West Coast Express thicker than buses (derived from `route_type`)
- Attribution footer preserved from scaffold, repositioned to not fight with the map
- Initial JS stays under SPEC's 300 KB gz budget (lazy-load the map component if maplibre-gl pushes us close)
- Manual verification in PR body: map loads, routes render with GTFS colors, pan/zoom smooth

## Notes

- Depends on: 02 (needs routes.geojson; merged)
- Does NOT depend on 03 — frequency coloring is deliberately deferred to 05
- maplibre-gl is ~200 KB gz; current init JS is 60 KB gz; code-splitting may be needed to stay comfortable under 300 KB
- PMTiles for dev: Protomaps public daily build URL (swap to R2 in deploy feature later)
- Stops not rendered yet (punt to a later feature — visually noisy without zoom-level thresholds)
- Commit plan:
  1. `feat: install maplibre-gl and pmtiles; wire the dark base style`
  2. `feat: render full-screen map with metro vancouver default view`
  3. `feat: load routes.geojson and render lines colored by route_color`
  4. `feat: distinguish skytrain/seabus/wce with thicker strokes`
  5. `refactor: lazy-load the map view to preserve the bundle budget` (only if measured need)

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
- 2026-04-17 — 03 Frequency Computation ([PR #3](https://github.com/adnanreza/transit-v1/pull/3))
