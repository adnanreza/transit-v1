import { describe, expect, it } from 'vitest'
import type {
  PatternFrequency,
  RouteFrequency,
} from '../../scripts/types/frequencies'
import {
  countMinorPatterns,
  majorPatternsSorted,
  normalizePatternTermini,
} from './route-patterns'

function emptyHeadways() {
  const day = {
    all_day: null,
    am_peak: null,
    midday: null,
    pm_peak: null,
    evening: null,
    late_night: null,
  }
  return { weekday: day, saturday: day, sunday: day }
}

function pattern(
  id: string,
  trip_share: number,
  overrides: Partial<PatternFrequency> = {},
): PatternFrequency {
  return {
    pattern_id: id,
    shape_ids: [],
    representative_stop_id: 's',
    first_stop_name: `${id} first`,
    last_stop_name: `${id} last`,
    trip_count: 1,
    trip_share,
    headways: emptyHeadways(),
    hourly: { weekday: {}, saturday: {}, sunday: {} },
    ...overrides,
  }
}

function route(patterns: PatternFrequency[]): RouteFrequency {
  return {
    route_id: 'r',
    agency_name: 'TransLink',
    band: 'standard',
    ftn_qualifies: false,
    ftn_failure: null,
    patterns,
  }
}

describe('majorPatternsSorted', () => {
  it('sorts by trip_share descending', () => {
    const r = route([
      pattern('c', 0.2),
      pattern('a', 0.5),
      pattern('b', 0.3),
    ])
    expect(majorPatternsSorted(r).map((p) => p.pattern_id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('filters out patterns with trip_share < 0.2', () => {
    const r = route([
      pattern('a', 0.5),
      pattern('b', 0.1),
      pattern('c', 0.2),
    ])
    expect(majorPatternsSorted(r).map((p) => p.pattern_id)).toEqual([
      'a',
      'c',
    ])
  })

  it('breaks ties by stable original order', () => {
    const r = route([
      pattern('first', 0.3),
      pattern('second', 0.3),
      pattern('third', 0.4),
    ])
    expect(majorPatternsSorted(r).map((p) => p.pattern_id)).toEqual([
      'third',
      'first',
      'second',
    ])
  })

  it('treats trip_share exactly 0.2 as major (inclusive boundary)', () => {
    const r = route([pattern('edge', 0.2)])
    expect(majorPatternsSorted(r)).toHaveLength(1)
  })

  it('returns an empty list when every pattern is minor', () => {
    const r = route([pattern('a', 0.1), pattern('b', 0.05)])
    expect(majorPatternsSorted(r)).toHaveLength(0)
  })
})

describe('countMinorPatterns', () => {
  it('counts patterns strictly below 0.2 trip_share', () => {
    const r = route([
      pattern('a', 0.5),
      pattern('b', 0.19),
      pattern('c', 0.2),
      pattern('d', 0.001),
    ])
    expect(countMinorPatterns(r)).toBe(2)
  })

  it('returns 0 when there are no minor patterns', () => {
    expect(countMinorPatterns(route([pattern('a', 0.6)]))).toBe(0)
  })

  it('returns 0 for a route with no patterns at all', () => {
    expect(countMinorPatterns(route([]))).toBe(0)
  })
})

describe('normalizePatternTermini', () => {
  function withTermini(
    id: string,
    first: string,
    last: string,
  ): PatternFrequency {
    return pattern(id, 0.5, { first_stop_name: first, last_stop_name: last })
  }

  it('collapses reverse-direction pairs into a single A ⇄ B entry', () => {
    const result = normalizePatternTermini([
      withTermini('fwd', 'Burrard', 'Dunbar'),
      withTermini('rev', 'Dunbar', 'Burrard'),
    ])
    expect(result).toEqual([{ a: 'Burrard', b: 'Dunbar' }])
  })

  it('keeps separate entries for a true branch (different endpoints)', () => {
    const result = normalizePatternTermini([
      withTermini('main-fwd', 'Downtown', 'UBC'),
      withTermini('main-rev', 'UBC', 'Downtown'),
      withTermini('branch', 'Downtown', 'Kerrisdale'),
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ a: 'Downtown', b: 'UBC' })
    expect(result[1]).toEqual({ a: 'Downtown', b: 'Kerrisdale' })
  })

  it('preserves first-seen direction for stable display ordering', () => {
    // "A → B" comes first, so that's what's shown — even though the reverse
    // pattern also exists in the list.
    const result = normalizePatternTermini([
      withTermini('first', 'A Street', 'B Avenue'),
      withTermini('second', 'B Avenue', 'A Street'),
    ])
    expect(result[0]).toEqual({ a: 'A Street', b: 'B Avenue' })
  })

  it('handles a single-pattern (one-way) route', () => {
    expect(
      normalizePatternTermini([withTermini('only', 'A', 'B')]),
    ).toEqual([{ a: 'A', b: 'B' }])
  })

  it('drops patterns with empty termini on both ends', () => {
    expect(
      normalizePatternTermini([withTermini('bad', '', '')]),
    ).toEqual([])
  })

  it('returns an empty list for no patterns', () => {
    expect(normalizePatternTermini([])).toEqual([])
  })
})
