# Current Feature: 03 Frequency Computation

## Status

In Progress

## Goals

- Parse `calendar.txt`, `calendar_dates.txt`, `trips.txt`, stream-parse `stop_times.txt`
- Derive trip patterns (hash of ordered `(stop_id, stop_sequence)` pairs)
- Compute per-trip-pattern headways at each pattern's busiest stop, for time windows and hourly buckets, on each day type
- Resolve day types (weekday / Saturday / Sunday-holiday) from calendar + calendar_dates (holiday exceptions → Sunday)
- FTN qualification: median headway ≤15 min in every hour 06:00–21:00 on all three day types; record first failing (day_type, hour)
- Route band = worst major pattern's band (major = ≥20% of route's trips); includes peak_only and night_only as distinct bands
- Emit `public/data/frequencies.json` per the schema in the spec
- Emit `scripts/types/frequencies.ts` (shared types — single source of truth)
- Unit tests for dayTypeForDate, tripPattern, medianHeadway, qualifiesFtn, routeBand

## Notes

- Depends on: 02 Data Pipeline Foundation (merged)
- frequencies.json budget: <500 KB gzipped; total data payload stays under SPEC's 5 MB
- stop_times.txt must be stream-parsed (176 MB uncompressed, 10M+ rows)
- Midnight-spanning trips: GTFS encodes `24:30:00`, `25:15:00` — modulo 24 for hour buckets but careful not to double-count across day types
- Commit plan:
  1. `feat: parse calendar and resolve day types`
  2. `feat: derive trip patterns and representative stops`
  3. `feat: stream-parse stop_times and compute pattern headways`
  4. `feat: qualify routes against FTN rule with failure details`
  5. `feat: emit frequencies.json with per-pattern breakdown`
  6. `test: add unit tests for headway and FTN logic`
  7. `chore: commit updated data snapshot` (may fold into earlier commits per 02 precedent)

## History

- 2026-04-17 — 01 Scaffold ([PR #1](https://github.com/adnanreza/transit-v1/pull/1))
- 2026-04-17 — 02 Data Pipeline Foundation ([PR #2](https://github.com/adnanreza/transit-v1/pull/2))
