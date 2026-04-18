import { describe, expect, it } from 'vitest'
import type {
  FrequenciesFile,
  PatternFrequency,
  RouteFrequency,
} from '../../scripts/types/frequencies'
import {
  BAND_COLORS,
  BAND_COLORS_DARK,
  BAND_COLORS_LIGHT,
  bandColors,
  busColorExpression,
  busOpacityExpression,
  DEFAULT_OPACITY,
  NO_SERVICE_COLOR,
  NO_SERVICE_OPACITY,
} from './band-palette'
import type { Band } from '../../scripts/types/frequencies'

function makePattern(
  trip_share: number,
  headway: number | null,
): PatternFrequency {
  return {
    pattern_id: 'p',
    shape_ids: [],
    representative_stop_id: 's',
    first_stop_name: '',
    last_stop_name: '',
    trip_count: 100,
    trip_share,
    headways: {
      weekday: { all_day: headway, am_peak: headway, midday: headway, pm_peak: headway, evening: headway, late_night: headway },
      saturday: { all_day: headway, am_peak: headway, midday: headway, pm_peak: headway, evening: headway, late_night: headway },
      sunday: { all_day: headway, am_peak: headway, midday: headway, pm_peak: headway, evening: headway, late_night: headway },
    },
    hourly: { weekday: {}, saturday: {}, sunday: {} },
  }
}

function route(
  route_id: string,
  band: RouteFrequency['band'],
  headway: number | null,
): RouteFrequency {
  return {
    route_id,
    agency_name: 'TransLink',
    band,
    ftn_qualifies: false,
    ftn_failure: null,
    patterns: [makePattern(1, headway)],
  }
}

function makeFrequencies(routes: RouteFrequency[]): FrequenciesFile {
  return Object.fromEntries(routes.map((r) => [r.route_id, r]))
}

describe('busColorExpression', () => {
  it('emits a match expression with one branch per populated band and bucket colors match BAND_COLORS', () => {
    const frequencies = makeFrequencies([
      route('vf1', 'very_frequent', 8),
      route('vf2', 'very_frequent', 9),
      route('f1', 'frequent', 12),
      route('s1', 'standard', 25),
      route('i1', 'infrequent', 45),
      route('pk1', 'peak_only', 10),
      route('n1', 'night_only', 12),
    ])

    const expr = busColorExpression(frequencies, 'weekday', 'all_day') as unknown as (
      | string
      | string[]
    )[]

    expect(expr[0]).toBe('match')
    // Each band contributes [ids, color]; 6 bands + head (match, ['get','route_id']) + trailing fallback.
    expect(expr).toHaveLength(2 + 6 * 2 + 1)
    expect(expr.at(-1)).toBe(NO_SERVICE_COLOR)

    // Walk the label/color pairs: very_frequent is first because it leads the
    // key order in BAND_COLORS.
    expect(expr[2]).toEqual(['vf1', 'vf2'])
    expect(expr[3]).toBe(BAND_COLORS.very_frequent)
    expect(expr[4]).toEqual(['f1'])
    expect(expr[5]).toBe(BAND_COLORS.frequent)
    expect(expr[6]).toEqual(['s1'])
    expect(expr[7]).toBe(BAND_COLORS.standard)
    expect(expr[8]).toEqual(['i1'])
    expect(expr[9]).toBe(BAND_COLORS.infrequent)
    expect(expr[10]).toEqual(['pk1'])
    expect(expr[11]).toBe(BAND_COLORS.peak_only)
    expect(expr[12]).toEqual(['n1'])
    expect(expr[13]).toBe(BAND_COLORS.night_only)
  })

  it('skips bands with zero routes — MapLibre rejects empty `match` label arrays', () => {
    const frequencies = makeFrequencies([
      route('f1', 'frequent', 12),
      route('i1', 'infrequent', 45),
    ])

    const expr = busColorExpression(frequencies, 'weekday', 'all_day') as unknown as (
      | string
      | string[]
    )[]

    // No very_frequent, standard, peak_only, or night_only routes → only two
    // label/color pairs between the head and the fallback.
    expect(expr).toHaveLength(2 + 2 * 2 + 1)
    expect(expr.flat()).not.toContain(BAND_COLORS.very_frequent)
    expect(expr.flat()).not.toContain(BAND_COLORS.standard)
    expect(expr.flat()).not.toContain(BAND_COLORS.peak_only)
  })

  it('falls through to just the NO_SERVICE_COLOR when no routes have service in the window', () => {
    const frequencies = makeFrequencies([route('x', 'standard', null)])

    const expr = busColorExpression(frequencies, 'weekday', 'all_day') as unknown as (
      | string
      | string[]
    )[]

    // ['match', ['get','route_id'], fallback] — no label/color branches.
    expect(expr).toHaveLength(3)
    expect(expr.at(-1)).toBe(NO_SERVICE_COLOR)
  })
})

describe('busOpacityExpression', () => {
  it('lists served route_ids at full opacity and dims everything else', () => {
    const frequencies = makeFrequencies([
      route('a', 'very_frequent', 8),
      route('b', 'standard', null),
      route('c', 'frequent', 12),
    ])

    const expr = busOpacityExpression(frequencies, 'weekday', 'all_day') as unknown as (
      | string
      | string[]
      | number
    )[]

    expect(expr[0]).toBe('match')
    expect(expr[2]).toEqual(['a', 'c'])
    expect(expr[3]).toBe(DEFAULT_OPACITY)
    expect(expr[4]).toBe(NO_SERVICE_OPACITY)
  })

  it('returns a literal NO_SERVICE_OPACITY when no route has service — match with empty label is invalid', () => {
    const frequencies = makeFrequencies([route('x', 'standard', null)])

    const expr = busOpacityExpression(frequencies, 'weekday', 'all_day') as unknown as (
      | string
      | number
    )[]

    expect(expr[0]).toBe('literal')
    expect(expr[1]).toBe(NO_SERVICE_OPACITY)
  })
})

describe('bandColors', () => {
  const BANDS: Band[] = [
    'very_frequent',
    'frequent',
    'standard',
    'infrequent',
    'peak_only',
    'night_only',
  ]

  it('returns the dark palette when asked for dark', () => {
    expect(bandColors('dark')).toEqual(BAND_COLORS_DARK)
  })

  it('returns the light palette when asked for light', () => {
    expect(bandColors('light')).toEqual(BAND_COLORS_LIGHT)
  })

  it('keeps the legacy BAND_COLORS alias pointing at the dark palette', () => {
    // Legend / panel / slider initially imported BAND_COLORS directly; the
    // alias keeps those call sites working while new code uses bandColors(theme).
    expect(BAND_COLORS).toBe(BAND_COLORS_DARK)
  })

  it('covers every canonical band in both palettes with a non-empty hex string', () => {
    for (const band of BANDS) {
      expect(BAND_COLORS_DARK[band]).toMatch(/^#[0-9a-f]{6}$/i)
      expect(BAND_COLORS_LIGHT[band]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('uses a different color for every band between themes (otherwise the inversion is a no-op)', () => {
    // If a light-theme band reuses the dark-theme color, the readability pass
    // that motivated the light palette would fail silently for that band.
    for (const band of BANDS) {
      expect(BAND_COLORS_LIGHT[band]).not.toBe(BAND_COLORS_DARK[band])
    }
  })
})

describe('busColorExpression respects theme', () => {
  it('emits dark-palette colors by default (no theme arg)', () => {
    const frequencies = makeFrequencies([
      route('a', 'very_frequent', 8),
      route('b', 'infrequent', 45),
    ])
    const expr = busColorExpression(frequencies, 'weekday', 'all_day') as unknown as string[]
    expect(expr.flat()).toContain(BAND_COLORS_DARK.very_frequent)
    expect(expr.flat()).toContain(BAND_COLORS_DARK.infrequent)
  })

  it('emits light-palette colors when theme is explicitly light', () => {
    const frequencies = makeFrequencies([
      route('a', 'very_frequent', 8),
      route('b', 'infrequent', 45),
    ])
    const expr = busColorExpression(
      frequencies,
      'weekday',
      'all_day',
      undefined,
      'light',
    ) as unknown as string[]
    expect(expr.flat()).toContain(BAND_COLORS_LIGHT.very_frequent)
    expect(expr.flat()).toContain(BAND_COLORS_LIGHT.infrequent)
    // And crucially NOT the dark ones — otherwise the user would see the wrong ramp
    expect(expr.flat()).not.toContain(BAND_COLORS_DARK.very_frequent)
  })
})
