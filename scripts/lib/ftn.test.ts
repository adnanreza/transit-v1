import { describe, it, expect } from 'vitest'
import { patternBandAndFtn, qualifiesFtn, routeBandFromPatterns } from './ftn.ts'
import type { Band, DayType, TimeWindow } from '../types/frequencies.ts'

// Helper: full hourly block, one headway for all hours 6..21 on all day types.
const uniformHourly = (headway: number | null): Record<DayType, Record<string, number | null>> => {
  const hours: Record<string, number | null> = {}
  for (let h = 6; h <= 21; h++) hours[String(h)] = headway
  return { weekday: { ...hours }, saturday: { ...hours }, sunday: { ...hours } }
}

const allDayWindows = (headway: number | null): Record<DayType, Record<TimeWindow, number | null>> => {
  const block: Record<TimeWindow, number | null> = {
    all_day: headway,
    am_peak: headway,
    midday: headway,
    pm_peak: headway,
    evening: headway,
    late_night: headway,
  }
  return { weekday: block, saturday: { ...block }, sunday: { ...block } }
}

describe('qualifiesFtn', () => {
  it('returns null when every hour on every day type has headway ≤15 min', () => {
    expect(qualifiesFtn(uniformHourly(10))).toBeNull()
    expect(qualifiesFtn(uniformHourly(15))).toBeNull() // exactly 15 passes
  })

  it('returns the first failing (day_type, hour) when a Sunday hour exceeds 15 min', () => {
    const hourly = uniformHourly(10)
    hourly.sunday['18'] = 20 // Sunday 6pm hour has 20-min headway
    expect(qualifiesFtn(hourly)).toEqual({ day_type: 'sunday', hour: 18 })
  })

  it('treats null (no service) as failing', () => {
    const hourly = uniformHourly(10)
    hourly.saturday['7'] = null
    expect(qualifiesFtn(hourly)).toEqual({ day_type: 'saturday', hour: 7 })
  })

  it('returns the earliest-day earliest-hour failure when multiple exist', () => {
    const hourly = uniformHourly(10)
    hourly.weekday['21'] = 30
    hourly.saturday['6'] = 30
    expect(qualifiesFtn(hourly)).toEqual({ day_type: 'weekday', hour: 21 })
  })
})

describe('patternBandAndFtn', () => {
  it('classifies peak_only when weekday service is confined to AM/PM peaks', () => {
    const headways = allDayWindows(null)
    headways.weekday.am_peak = 20
    headways.weekday.pm_peak = 20
    const { band } = patternBandAndFtn(headways, uniformHourly(null))
    expect(band).toBe('peak_only')
  })

  it('classifies night_only when only late_night has service on weekdays', () => {
    const headways = allDayWindows(null)
    headways.weekday.late_night = 30
    const { band } = patternBandAndFtn(headways, uniformHourly(null))
    expect(band).toBe('night_only')
  })

  it('classifies very_frequent when FTN qualifies and weekday AM peak ≤10', () => {
    const { band, ftn_qualifies } = patternBandAndFtn(allDayWindows(8), uniformHourly(8))
    expect(band).toBe('very_frequent')
    expect(ftn_qualifies).toBe(true)
  })

  it('classifies frequent when FTN qualifies but weekday AM peak >10', () => {
    const headways = allDayWindows(12)
    const { band } = patternBandAndFtn(headways, uniformHourly(12))
    expect(band).toBe('frequent')
  })

  it('classifies standard when non-FTN but weekday all-day ≤30', () => {
    const { band, ftn_qualifies, ftn_failure } = patternBandAndFtn(allDayWindows(25), uniformHourly(25))
    expect(band).toBe('standard')
    expect(ftn_qualifies).toBe(false)
    expect(ftn_failure).not.toBeNull()
  })

  it('classifies infrequent when weekday all-day >30', () => {
    const { band } = patternBandAndFtn(allDayWindows(45), uniformHourly(45))
    expect(band).toBe('infrequent')
  })
})

describe('routeBandFromPatterns', () => {
  const mkPattern = (band: Band, trip_share: number) => ({
    band,
    ftn_qualifies: band === 'very_frequent' || band === 'frequent',
    ftn_failure: band === 'very_frequent' || band === 'frequent' ? null : { day_type: 'weekday' as DayType, hour: 12 },
    trip_share,
  })

  it('picks the worst band among major patterns (≥20% share)', () => {
    const result = routeBandFromPatterns([
      mkPattern('very_frequent', 0.6), // major + best
      mkPattern('standard', 0.3), // major + worse → wins
      mkPattern('infrequent', 0.1), // minor — ignored
    ])
    expect(result.band).toBe('standard')
    expect(result.ftn_qualifies).toBe(false)
  })

  it('ranks peak_only worse than any frequency-ramp band', () => {
    const result = routeBandFromPatterns([
      mkPattern('very_frequent', 0.5),
      mkPattern('peak_only', 0.5),
    ])
    expect(result.band).toBe('peak_only')
  })

  it('falls back to all patterns when no major pattern exists', () => {
    const result = routeBandFromPatterns([
      mkPattern('frequent', 0.15),
      mkPattern('standard', 0.15),
      mkPattern('infrequent', 0.15),
    ])
    expect(result.band).toBe('infrequent')
  })
})
