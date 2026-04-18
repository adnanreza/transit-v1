import { describe, expect, it } from 'vitest'
import type {
  DayType,
  PatternFrequency,
  RouteFrequency,
  TimeWindow,
} from '../../scripts/types/frequencies'
import { DEFAULT_THRESHOLDS, routeBandAt, type BandThresholds } from './route-band'

const DAY: DayType = 'weekday'
const WINDOW: TimeWindow = 'all_day'

function makePattern(
  trip_share: number,
  headway: number | null,
  overrides: Partial<PatternFrequency> = {},
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
    hourly: {
      weekday: {},
      saturday: {},
      sunday: {},
    },
    ...overrides,
  }
}

function makeRoute(
  band: RouteFrequency['band'],
  patterns: PatternFrequency[],
): RouteFrequency {
  return {
    route_id: 'r',
    agency_name: 'TransLink',
    band,
    ftn_qualifies: false,
    ftn_failure: null,
    patterns,
  }
}

describe('routeBandAt', () => {
  it('returns peak_only regardless of the selected window', () => {
    const route = makeRoute('peak_only', [makePattern(1, 8)])
    expect(routeBandAt(route, 'weekday', 'evening')).toBe('peak_only')
    expect(routeBandAt(route, 'sunday', 'am_peak')).toBe('peak_only')
  })

  it('returns night_only regardless of the selected window', () => {
    const route = makeRoute('night_only', [makePattern(1, 12)])
    expect(routeBandAt(route, 'weekday', 'midday')).toBe('night_only')
  })

  it('derives a band from a single major pattern headway', () => {
    expect(routeBandAt(makeRoute('very_frequent', [makePattern(1, 8)]), DAY, WINDOW)).toBe('very_frequent')
    expect(routeBandAt(makeRoute('frequent', [makePattern(1, 12)]), DAY, WINDOW)).toBe('frequent')
    expect(routeBandAt(makeRoute('standard', [makePattern(1, 25)]), DAY, WINDOW)).toBe('standard')
    expect(routeBandAt(makeRoute('infrequent', [makePattern(1, 45)]), DAY, WINDOW)).toBe('infrequent')
  })

  it('places 10 and 15 on the correct band boundaries', () => {
    expect(routeBandAt(makeRoute('very_frequent', [makePattern(1, 10)]), DAY, WINDOW)).toBe('very_frequent')
    expect(routeBandAt(makeRoute('frequent', [makePattern(1, 15)]), DAY, WINDOW)).toBe('frequent')
    expect(routeBandAt(makeRoute('standard', [makePattern(1, 30)]), DAY, WINDOW)).toBe('standard')
  })

  it('returns the worst band when multiple major patterns disagree', () => {
    const route = makeRoute('standard', [makePattern(0.5, 8), makePattern(0.5, 25)])
    expect(routeBandAt(route, DAY, WINDOW)).toBe('standard')
  })

  it('ignores minor patterns (trip_share < 0.2) even if they would be worse', () => {
    const route = makeRoute('very_frequent', [makePattern(0.85, 8), makePattern(0.15, 60)])
    expect(routeBandAt(route, DAY, WINDOW)).toBe('very_frequent')
  })

  it('counts a pattern at exactly 0.2 trip_share as major', () => {
    const route = makeRoute('standard', [makePattern(0.8, 8), makePattern(0.2, 25)])
    expect(routeBandAt(route, DAY, WINDOW)).toBe('standard')
  })

  it('skips patterns with null headway and uses the rest', () => {
    const route = makeRoute('frequent', [makePattern(0.5, null), makePattern(0.5, 12)])
    expect(routeBandAt(route, DAY, WINDOW)).toBe('frequent')
  })

  it('returns null when every major pattern has no service in the window', () => {
    const route = makeRoute('standard', [makePattern(0.6, null), makePattern(0.4, null)])
    expect(routeBandAt(route, DAY, WINDOW)).toBeNull()
  })
})

describe('routeBandAt with custom thresholds', () => {
  it('reproduces default behavior when thresholds match the SPEC defaults', () => {
    const route = makeRoute('frequent', [makePattern(1, 12)])
    expect(routeBandAt(route, DAY, WINDOW, DEFAULT_THRESHOLDS)).toBe('frequent')
  })

  it('reclassifies a 9-minute route as frequent when very_frequent cap drops to 8', () => {
    const route = makeRoute('very_frequent', [makePattern(1, 9)])
    const strict: BandThresholds = { very_frequent: 8, frequent: 15, standard: 30 }
    expect(routeBandAt(route, DAY, WINDOW)).toBe('very_frequent')
    expect(routeBandAt(route, DAY, WINDOW, strict)).toBe('frequent')
  })

  it('reclassifies a 20-minute route as frequent when frequent cap is raised to 25', () => {
    const route = makeRoute('standard', [makePattern(1, 20)])
    const relaxed: BandThresholds = { very_frequent: 10, frequent: 25, standard: 30 }
    expect(routeBandAt(route, DAY, WINDOW)).toBe('standard')
    expect(routeBandAt(route, DAY, WINDOW, relaxed)).toBe('frequent')
  })

  it('reclassifies a 35-minute route as standard when standard cap is raised to 40', () => {
    const route = makeRoute('infrequent', [makePattern(1, 35)])
    const wider: BandThresholds = { very_frequent: 10, frequent: 15, standard: 40 }
    expect(routeBandAt(route, DAY, WINDOW)).toBe('infrequent')
    expect(routeBandAt(route, DAY, WINDOW, wider)).toBe('standard')
  })

  it('does not affect peak_only or night_only routes (different axis)', () => {
    const peak = makeRoute('peak_only', [makePattern(1, 6)])
    const night = makeRoute('night_only', [makePattern(1, 12)])
    const tight: BandThresholds = { very_frequent: 5, frequent: 10, standard: 20 }
    expect(routeBandAt(peak, DAY, WINDOW, tight)).toBe('peak_only')
    expect(routeBandAt(night, DAY, WINDOW, tight)).toBe('night_only')
  })

  it('still picks the worst major-pattern band under custom thresholds', () => {
    const route = makeRoute('standard', [makePattern(0.5, 8), makePattern(0.5, 20)])
    const relaxed: BandThresholds = { very_frequent: 10, frequent: 25, standard: 45 }
    // Pattern A (8 min) is very_frequent under both; pattern B (20 min) is
    // standard by default but moves up to frequent when cap rises to 25.
    // Worst of {very_frequent, frequent} is frequent.
    expect(routeBandAt(route, DAY, WINDOW, relaxed)).toBe('frequent')
  })
})
