import { describe, it, expect } from 'vitest'
import {
  computeTripPattern,
  groupTripsByPattern,
  tripPatternHash,
  type StopTimeRow,
  type TripPatternWithMeta,
} from './patterns.ts'

describe('tripPatternHash', () => {
  it('returns the same hash for identical stop sequences', () => {
    expect(tripPatternHash(['A', 'B', 'C'])).toBe(tripPatternHash(['A', 'B', 'C']))
  })

  it('returns different hashes for different orderings of the same stops', () => {
    expect(tripPatternHash(['A', 'B', 'C'])).not.toBe(tripPatternHash(['C', 'B', 'A']))
  })

  it('returns different hashes for different stop sets', () => {
    expect(tripPatternHash(['A', 'B', 'C'])).not.toBe(tripPatternHash(['A', 'B', 'D']))
  })
})

describe('computeTripPattern', () => {
  it('sorts rows by stop_sequence regardless of input order', () => {
    const rows: StopTimeRow[] = [
      { trip_id: 't1', stop_id: 'C', stop_sequence: 3, arrival_time: '07:10:00' },
      { trip_id: 't1', stop_id: 'A', stop_sequence: 1, arrival_time: '07:00:00' },
      { trip_id: 't1', stop_id: 'B', stop_sequence: 2, arrival_time: '07:05:00' },
    ]
    const p = computeTripPattern('t1', rows)
    expect(p.stop_ids).toEqual(['A', 'B', 'C'])
    expect(p.first_stop_id).toBe('A')
    expect(p.first_arrival_time).toBe('07:00:00')
  })
})

describe('groupTripsByPattern', () => {
  it('collects trip_ids per pattern and unions shape_ids', () => {
    const make = (id: string, pat: string, shape: string): TripPatternWithMeta => ({
      trip_id: id,
      pattern_id: pat,
      stop_ids: [],
      first_stop_id: 'A',
      first_arrival_time: '07:00:00',
      route_id: 'R1',
      shape_id: shape,
      service_id: 'weekday',
    })
    const groups = groupTripsByPattern([
      make('t1', 'pA', 's1'),
      make('t2', 'pA', 's1'),
      make('t3', 'pA', 's2'), // different shape, same pattern
      make('t4', 'pB', 's3'),
    ])
    expect(groups.size).toBe(2)
    expect(groups.get('pA')?.trip_ids).toEqual(['t1', 't2', 't3'])
    expect([...(groups.get('pA')?.shape_ids ?? [])].sort()).toEqual(['s1', 's2'])
  })
})
