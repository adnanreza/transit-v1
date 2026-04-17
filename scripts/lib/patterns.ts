import { Readable } from 'node:stream'
import crypto from 'node:crypto'
import { parse as parseStream } from 'csv-parse'

export interface StopTimeRow {
  trip_id: string
  stop_id: string
  stop_sequence: number
  arrival_time: string // GTFS HH:MM:SS — can exceed 24:00:00 for post-midnight trips
}

export interface TripStopTimes {
  trip_id: string
  rows: StopTimeRow[]
}

// Stable short hash of an ordered stop_id sequence. Two trips with the same
// stop sequence produce the same pattern_id; any change (addition, removal,
// reorder) produces a different one. 12 hex chars → ~48 bits of entropy, more
// than enough for the ~2k patterns we see in practice.
export function tripPatternHash(stopIdsOrdered: string[]): string {
  const hash = crypto.createHash('sha1')
  for (const s of stopIdsOrdered) {
    hash.update(s)
    hash.update('\n')
  }
  return hash.digest('hex').slice(0, 12)
}

// Streaming read of stop_times.txt. Assumes rows for each trip are consecutive
// (standard GTFS convention — TransLink's feed conforms). Yields one
// TripStopTimes per trip, so the caller never holds more than one trip's rows
// in memory at a time.
export async function* streamTripStopTimes(
  stream: Readable,
): AsyncGenerator<TripStopTimes> {
  const parser = stream.pipe(
    parseStream({ columns: true, skip_empty_lines: true, bom: true }),
  )
  let current: TripStopTimes | null = null
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const tripId = row.trip_id
    if (current && current.trip_id !== tripId) {
      yield current
      current = null
    }
    if (!current) {
      current = { trip_id: tripId, rows: [] }
    }
    current.rows.push({
      trip_id: tripId,
      stop_id: row.stop_id,
      stop_sequence: parseInt(row.stop_sequence, 10),
      arrival_time: row.arrival_time || row.departure_time || '',
    })
  }
  if (current) yield current
}

export interface TripPattern {
  trip_id: string
  pattern_id: string
  stop_ids: string[]
  first_stop_id: string
  first_arrival_time: string
}

// Given one trip's stop_times rows (any order), compute its pattern.
export function computeTripPattern(trip_id: string, rows: StopTimeRow[]): TripPattern {
  const sorted = [...rows].sort((a, b) => a.stop_sequence - b.stop_sequence)
  const stopIds = sorted.map((r) => r.stop_id)
  return {
    trip_id,
    pattern_id: tripPatternHash(stopIds),
    stop_ids: stopIds,
    first_stop_id: sorted[0]?.stop_id ?? '',
    first_arrival_time: sorted[0]?.arrival_time ?? '',
  }
}

export interface PatternSummary {
  pattern_id: string
  route_id: string
  stop_ids: string[] // canonical ordered stop sequence
  representative_stop_id: string // first stop — all stops on a pattern see the same trips, so any deterministic choice works
  trip_ids: string[]
  shape_ids: Set<string>
}

// Group trips by pattern_id. Trips arrive as (TripPattern + route_id + shape_id)
// tuples — the stream provided only stop_times data, route/shape come from
// trips.txt.
export interface TripPatternWithMeta extends TripPattern {
  route_id: string
  shape_id: string
  service_id: string
}

export function groupTripsByPattern(
  trips: TripPatternWithMeta[],
): Map<string, PatternSummary> {
  const patterns = new Map<string, PatternSummary>()
  for (const t of trips) {
    let p = patterns.get(t.pattern_id)
    if (!p) {
      p = {
        pattern_id: t.pattern_id,
        route_id: t.route_id,
        stop_ids: t.stop_ids,
        representative_stop_id: t.first_stop_id,
        trip_ids: [],
        shape_ids: new Set<string>(),
      }
      patterns.set(t.pattern_id, p)
    }
    p.trip_ids.push(t.trip_id)
    if (t.shape_id) p.shape_ids.add(t.shape_id)
  }
  return patterns
}
