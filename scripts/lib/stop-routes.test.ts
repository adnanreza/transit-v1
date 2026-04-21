import { describe, expect, it } from 'vitest'
import { buildStopRoutesIndex } from './stop-routes.ts'
import type { PatternSummary } from './patterns.ts'

function pattern(
  pattern_id: string,
  route_id: string,
  stop_ids: string[],
): PatternSummary {
  return {
    pattern_id,
    route_id,
    stop_ids,
    representative_stop_id: stop_ids[0] ?? '',
    trip_ids: [],
    shape_ids: new Set(),
  }
}

describe('buildStopRoutesIndex', () => {
  it('reverses patterns into a stop → [route_id] map', () => {
    const patterns = [
      pattern('p1', '099', ['s1', 's2', 's3']),
      pattern('p2', '014', ['s2', 's3', 's4']),
    ]
    const routes = [
      { route_id: '099', route_short_name: '099' },
      { route_id: '014', route_short_name: '014' },
    ]
    const index = buildStopRoutesIndex(patterns, routes)
    expect(index).toEqual({
      s1: ['099'],
      s2: ['014', '099'], // 014 sorts first numerically
      s3: ['014', '099'],
      s4: ['014'],
    })
  })

  it('dedupes a stop that appears on multiple patterns of the same route', () => {
    const patterns = [
      pattern('p1', '099', ['s1', 's2']),
      pattern('p2', '099', ['s2', 's3']), // s2 on both patterns
    ]
    const routes = [{ route_id: '099', route_short_name: '099' }]
    const index = buildStopRoutesIndex(patterns, routes)
    expect(index.s2).toEqual(['099'])
  })

  it('sorts route_ids numeric-then-alpha by short name', () => {
    const patterns = [
      pattern('pA', 'r-a', ['s1']),
      pattern('pR4', 'r-r4', ['s1']),
      pattern('p99', 'r-99', ['s1']),
      pattern('p340', 'r-340', ['s1']),
    ]
    const routes = [
      { route_id: 'r-a', route_short_name: 'N10' },
      { route_id: 'r-r4', route_short_name: 'R4' },
      { route_id: 'r-99', route_short_name: '099' },
      { route_id: 'r-340', route_short_name: '340' },
    ]
    const index = buildStopRoutesIndex(patterns, routes)
    // Numeric short names (99 < 340) come first, letters after, alpha order.
    expect(index.s1).toEqual(['r-99', 'r-340', 'r-a', 'r-r4'])
  })

  it('returns an empty object when there are no patterns', () => {
    const index = buildStopRoutesIndex([], [])
    expect(index).toEqual({})
  })
})
