# 03 — Frequency Computation

Compute headways and FTN qualification per trip-pattern, emit `frequencies.json`. This is the most logic-dense feature in the project and the one a hiring manager will actually read — its correctness determines whether the map tells the truth.

## Acceptance Criteria

- `npm run prepare-data` parses `calendar.txt`, `calendar_dates.txt`, `trips.txt`, and (stream) `stop_times.txt` in addition to the files 02 already handles.
- **Trip patterns** are derived: a pattern is a hash of the ordered `(stop_id, stop_sequence)` pairs of a trip. Two trips with identical stop sequences share a pattern.
- **Per-trip-pattern headways** are computed at the pattern's **busiest stop** (the stop with the most trips on that pattern), for each of the time windows below, on each of the three day types.
- **Day types** (weekday / Saturday / Sunday-holiday) are resolved from `calendar.txt` and `calendar_dates.txt`. Dates with a holiday exception are counted as Sunday service (per SPEC).
- **Time windows** (SPEC-aligned):
  - `all_day` (informational; not used for FTN)
  - `am_peak` (06:00–09:00)
  - `midday` (09:00–15:00)
  - `pm_peak` (15:00–18:00)
  - `evening` (18:00–22:00)
  - `late_night` (22:00–06:00)
  - plus **hourly buckets** 06..21 on every day type — required for the FTN rule.
- **FTN qualification** follows the SPEC rule *exactly*: median headway ≤15 min in **every** hour-long window from 06:00 to 21:00 on **all three** day types. One failing hour on one day type disqualifies. The output records the *first* failing `(day_type, hour)` when a route fails, so the detail panel can explain why.
- **Route band** is the band of the route's **worst major pattern** — major = pattern carrying ≥20% of the route's trips. Bands: `very_frequent` | `frequent` | `standard` | `infrequent` | `peak_only` | `night_only`.
- **Peak-only** (service confined to AM/PM peaks) and **night-only** (service 22:00–05:00, e.g. NightBus) are distinct bands, not points on the frequency ramp. Per SPEC.
- **`public/data/frequencies.json`** emitted with the schema below. Also emit a `scripts/types/frequencies.ts` (or similar shared types file) the app code can import — single source of truth for the shape.
- **Unit tests** (Vitest) cover the pure logic:
  - `dayTypeForDate(date, calendar, calendarDates)` — holidays mapping, midnight-spanning trips, active service IDs
  - `tripPattern(stopTimes)` — same stop sequence → same hash, different sequence → different hash
  - `medianHeadway(trips, windowStart, windowEnd)` — with edge cases: zero trips, one trip, midnight-spanning
  - `qualifiesFtn(patternHourlyFrequencies)` — passes on a fully-compliant pattern, fails with correct `(day_type, hour)` reason on realistic failures
  - `routeBand(patterns)` — worst-major-pattern rule with varying trip shares

## Output Schema

```ts
// scripts/types/frequencies.ts
export type DayType = 'weekday' | 'saturday' | 'sunday'
export type TimeWindow = 'all_day' | 'am_peak' | 'midday' | 'pm_peak' | 'evening' | 'late_night'
export type Band = 'very_frequent' | 'frequent' | 'standard' | 'infrequent' | 'peak_only' | 'night_only'

export interface PatternFrequency {
  pattern_id: string
  shape_ids: string[]
  representative_stop_id: string
  trip_count: number
  trip_share: number              // 0..1
  headways: Record<DayType, Record<TimeWindow, number | null>>  // null = no service in window
  hourly: Record<DayType, Record<string, number | null>>        // keys "6".."21"
}

export interface RouteFrequency {
  route_id: string
  band: Band
  ftn_qualifies: boolean
  ftn_failure: { day_type: DayType; hour: number } | null
  patterns: PatternFrequency[]
}

export type FrequenciesFile = Record<string, RouteFrequency>  // keyed by route_id
```

## Performance / Data Budget

- `frequencies.json` < 500 KB gzipped. Hundreds of routes × 3 day types × 6 windows × a handful of patterns is small.
- Total data payload stays under SPEC's 5 MB.
- `stop_times.txt` must be stream-parsed; never `readFile` it whole.

## Out of Scope

- Rendering frequencies on the map (that's `05-frequency-coloring`).
- The UI toggle for day type / time window — comes with the map coloring.
- Detail panel UI — comes with the side panel feature.
- Interlined trip handling — SPEC flags this as an open question; audit after this PR and decide whether to merge or split.

## Depends On

- `02 Data Pipeline Foundation` (must be merged — this feature extends the same `scripts/build-data.ts`).

## Notes

- Commit plan (suggested):
  - `feat: parse calendar and resolve day types`
  - `feat: derive trip patterns and representative stops`
  - `feat: stream-parse stop_times and compute pattern headways`
  - `feat: qualify routes against FTN rule with failure details`
  - `feat: emit frequencies.json with per-pattern breakdown`
  - `test: add unit tests for headway and FTN logic`
  - `chore: commit updated data snapshot`
- Midnight-spanning trips: GTFS encodes late-night service as `24:30:00`, `25:15:00` etc. Handle by treating hour-of-day modulo 24, but be careful not to double-count a trip across day types.
- `feed_info.txt` is optional per GTFS spec. If missing, use the SHA-256 prefix of the zip as the "version" in meta.json (already handled in 02).
