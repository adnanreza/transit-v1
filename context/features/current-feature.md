# Current Feature: 02 Data Pipeline Foundation

## Status

In Progress

## Goals

- `npm run prepare-data` runs `scripts/build-data.ts` end-to-end (download → parse → emit)
- Downloads GTFS zip from `https://gtfs-static.translink.ca/gtfs/google_transit.zip` to `.cache/gtfs.zip`, skips re-download when SHA-256 matches
- Emits `public/data/routes.geojson` (LineString features, simplified via mapshaper, <3 MB gz)
- Emits `public/data/stops.geojson` (Point features, <500 KB gz)
- Emits `public/data/meta.json` with feed_version, generated_at, and the verbatim TransLink attribution + disclaimer + OSM attribution strings
- HandyDART excluded at the routes layer
- Stream-parse `shapes.txt` (never load wholesale)
- Unit tests for pure helpers: route filtering, shape grouping, property extraction
- Initial snapshot of `public/data/` committed (regenerated weekly via future cron PR)

## Notes

- Depends on: 01 Scaffold (merged)
- Total data payload target: <5 MB per SPEC
- TS execution: `tsx` as devDep
- CSV parsing: `csv-parse` streaming API
- Zip extraction: `yauzl` (streaming)
- Simplification: `mapshaper` Node API
- Attribution strings are verbatim-required by TransLink's license:
  - `"Route and arrival data used in this product or service is provided by permission of TransLink."`
  - `"TransLink assumes no responsibility for the accuracy or currency of the Data used in this product or service."`
- Commit plan:
  1. `feat: download and cache gtfs feed with sha256 check`
  2. `feat: parse routes and stops from gtfs`
  3. `feat: stream-parse shapes and emit routes.geojson`
  4. `chore: simplify route geometries with mapshaper`
  5. `feat: emit meta.json with feed version and attribution`
  6. `test: add unit tests for gtfs parsing helpers`
  7. `chore: commit initial public/data snapshot`

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
