import { describe, it, expect } from 'vitest'
import {
  computeHeadwaysForWindows,
  computeHourlyHeadways,
  medianHeadwaySeconds,
  parseGtfsTime,
} from './headways.ts'

describe('parseGtfsTime', () => {
  it('parses a basic HH:MM:SS', () => {
    expect(parseGtfsTime('07:30:45')).toBe(7 * 3600 + 30 * 60 + 45)
  })

  it('parses 24:00+ post-midnight times (GTFS convention for same service day)', () => {
    expect(parseGtfsTime('25:30:00')).toBe(25 * 3600 + 30 * 60)
  })

  it('returns -1 for malformed input', () => {
    expect(parseGtfsTime('not a time')).toBe(-1)
    expect(parseGtfsTime('')).toBe(-1)
  })
})

describe('medianHeadwaySeconds', () => {
  it('returns null for fewer than two timestamps', () => {
    expect(medianHeadwaySeconds([])).toBeNull()
    expect(medianHeadwaySeconds([0])).toBeNull()
  })

  it('returns the gap for exactly two timestamps', () => {
    expect(medianHeadwaySeconds([0, 600])).toBe(600)
  })

  it('returns the median of consecutive gaps for more than two timestamps', () => {
    // Arrivals: 0, 600, 1500, 2100 → gaps: 600, 900, 600 → sorted 600, 600, 900 → median 600
    expect(medianHeadwaySeconds([0, 600, 1500, 2100])).toBe(600)
  })

  it('is order-independent (sorts internally)', () => {
    expect(medianHeadwaySeconds([2100, 0, 1500, 600])).toBe(600)
  })
})

describe('computeHeadwaysForWindows', () => {
  it('buckets times into windows and reports null for windows with <2 trips', () => {
    // Build times: six trips in AM peak, two in PM peak, none elsewhere.
    const amTimes = [6.5, 6.75, 7, 7.25, 7.5, 8].map((h) => h * 3600) // 15-min headway
    const pmTimes = [15, 17].map((h) => h * 3600) // 2-hour gap
    const headways = computeHeadwaysForWindows([...amTimes, ...pmTimes])
    expect(headways.am_peak).toBe(15) // minutes
    expect(headways.pm_peak).toBe(120)
    expect(headways.midday).toBeNull()
    expect(headways.evening).toBeNull()
  })

  it('includes post-midnight GTFS times (24:00+) in the late_night window', () => {
    // 23:00, 24:30 (= 00:30 next day), 25:30 (= 01:30 next day)
    const times = [23 * 3600, 24.5 * 3600, 25.5 * 3600]
    const headways = computeHeadwaysForWindows(times)
    expect(headways.late_night).not.toBeNull()
  })
})

describe('computeHourlyHeadways', () => {
  it('buckets by clock hour mod 24, so 25:30 → hour 1 (not in 6..21)', () => {
    // 6 trips in hour 7 (15-min headway), 1 trip in hour 12, 2 trips at 25:30 and 26:30 (post-midnight)
    const times = [
      7 * 3600, 7.25 * 3600, 7.5 * 3600, 7.75 * 3600, // 4 trips hour 7, 15-min gaps
      12 * 3600, // 1 trip hour 12 — headway null
      25.5 * 3600, 26.5 * 3600, // mod 24 → hours 1 and 2 — not in 6..21
    ]
    const hourly = computeHourlyHeadways(times)
    expect(hourly['7']).toBe(15)
    expect(hourly['12']).toBeNull()
    expect(hourly['1']).toBeUndefined() // not a key in 6..21
  })
})
