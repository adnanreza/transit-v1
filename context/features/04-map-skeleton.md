# 04 — Map Skeleton

Full-screen MapLibre GL map with a PMTiles base and the route lines drawn on top. **No frequency coloring, no controls, no interactivity beyond pan/zoom** — those land in `05-frequency-coloring` and `06-controls`. This feature is about standing up the rendering substrate.

## Acceptance Criteria

- App replaces the placeholder page with a **full-screen MapLibre GL map** centered on Metro Vancouver (approx. `[-123.05, 49.25]`, zoom ~10).
- **Protomaps PMTiles** base map loaded via the `pmtiles` npm package's MapLibre protocol handler. Use a **configurable URL** (environment variable `VITE_PMTILES_URL` with a sensible dev default) so prod can point at R2 without code changes.
- **Base style** is dark — SPEC says dark makes colored routes pop. Use Protomaps' dark theme.
- **`public/data/routes.geojson` is rendered** as line features over the base map. Each route's line uses that route's own `route_color` from the GTFS properties (temporary — frequency bands replace this in `05-frequency-coloring`).
- **Mode-distinct line widths** per SPEC: SkyTrain / SeaBus / West Coast Express are visibly thicker than buses. Derive from `route_type` in the GeoJSON properties.
- **Stops are not rendered yet** (punt to `05` or a later feature — they're visually noisy without zoom-level thresholds).
- **Attribution footer survives.** TransLink + OSM credits stay visible; the scaffold's footer is preserved, just resized/positioned to not fight with the map.
- **Bundle size** stays within SPEC's 300 KB gz initial JS budget. `maplibre-gl` is ~200 KB gz on its own, so use dynamic `import()` to code-split the map view out of the initial bundle if needed to stay comfortable.
- **Manual verification** documented in the PR body: map loads, routes render with their GTFS colors, pan/zoom feels smooth on a mid-range laptop.

## Performance / Data Budget

- Initial JS < 300 KB gzipped (SPEC's full-app target). If `maplibre-gl` + deps push us close, lazy-load the map component so the initial shell is small and the map chunk loads in parallel.
- Route rendering should stay above 30 fps at typical zoom levels. If it doesn't, line simplification is the tool (already partly handled by 02's mapshaper step).

## Out of Scope

- Rendering `public/data/frequencies.json` → `05-frequency-coloring`.
- Controls (day-type toggle, time-window selector, threshold slider, mode filter, search) → `06-controls`.
- Route detail panel on click → its own feature later.
- URL state for filters → `07-url-state` later.
- Stops rendering.
- R2 upload of the PMTiles file → deploy feature, or a one-off manual step called out in the README.

## Depends On

- `02 Data Pipeline Foundation` (needs `public/data/routes.geojson` to exist).
- Does **not** depend on `03-frequency-computation` — this is intentional. Building 04 on top of 02 alone validates that the map renders before we layer frequency logic in 05.

## Notes

- **PMTiles for Metro Vancouver:** for dev, use Protomaps' public daily build URL in `VITE_PMTILES_URL`. For production, the file will eventually live at an R2 bucket with a custom domain. Document the dev/prod swap in the README.
- **MapLibre styling:** Protomaps ships basemap styles in their `protomaps-themes-base` package (or the equivalent by that name at install time). Use the dark variant.
- **Code-splitting:** if needed, wrap the map component in `React.lazy()` and render a lightweight `<div className="h-screen" />` skeleton while it loads.
- **Commit plan** (suggested):
  - `feat: install maplibre-gl and pmtiles; wire the dark base style`
  - `feat: render full-screen map with metro vancouver default view`
  - `feat: load routes.geojson and render lines colored by route_color`
  - `feat: distinguish skytrain/seabus/wce with thicker strokes`
  - `refactor: lazy-load the map view to preserve the bundle budget` (only if needed after measuring)
