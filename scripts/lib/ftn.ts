import type { Band, DayType, TimeWindow } from '../types/frequencies.ts'

const FTN_THRESHOLD_MIN = 15
const FREQUENT_PEAK_THRESHOLD_MIN = 10
const STANDARD_THRESHOLD_MIN = 30
const MAJOR_PATTERN_TRIP_SHARE = 0.2

// The SPEC rule: median headway ≤15 min in every hour-long window from 06:00
// to 21:00 on all three day types. One failing hour on one day type fails.
// Null = no service in that hour, which also fails (can't be "turn up and go"
// if there are no trips).
// Returns the FIRST failing (day_type, hour), or null if the pattern
// qualifies on every count.
export function qualifiesFtn(
  hourly: Record<DayType, Record<string, number | null>>,
): { day_type: DayType; hour: number } | null {
  for (const dayType of ['weekday', 'saturday', 'sunday'] as DayType[]) {
    for (let h = 6; h <= 21; h++) {
      const headway = hourly[dayType][String(h)]
      if (headway === null || headway > FTN_THRESHOLD_MIN) {
        return { day_type: dayType, hour: h }
      }
    }
  }
  return null
}

// Per-pattern band + FTN status. Peak-only and night-only are on a different
// axis than the frequency ramp (when a route runs, not how often) and take
// precedence: if a pattern only runs in peaks, we label it peak_only and
// don't try to rank its frequency.
export function patternBandAndFtn(
  headways: Record<DayType, Record<TimeWindow, number | null>>,
  hourly: Record<DayType, Record<string, number | null>>,
): {
  band: Band
  ftn_qualifies: boolean
  ftn_failure: { day_type: DayType; hour: number } | null
} {
  const wk = headways.weekday
  const hasPeaks = wk.am_peak !== null || wk.pm_peak !== null
  const hasMidday = wk.midday !== null
  const hasEvening = wk.evening !== null
  const hasLateNight = wk.late_night !== null
  const hasAllDay = wk.all_day !== null

  // Peak-only: service only in AM/PM peak windows, nothing in midday / evening / night.
  if (hasPeaks && !hasMidday && !hasEvening && !hasLateNight) {
    return {
      band: 'peak_only',
      ftn_qualifies: false,
      ftn_failure: { day_type: 'weekday', hour: 12 },
    }
  }

  // Night-only: only late_night service, no daytime at all.
  if (hasLateNight && !hasPeaks && !hasMidday && !hasEvening) {
    return {
      band: 'night_only',
      ftn_qualifies: false,
      ftn_failure: { day_type: 'weekday', hour: 12 },
    }
  }

  // No weekday service at all — rare edge case, treat as infrequent.
  if (!hasAllDay) {
    return {
      band: 'infrequent',
      ftn_qualifies: false,
      ftn_failure: { day_type: 'weekday', hour: 6 },
    }
  }

  const failure = qualifiesFtn(hourly)
  if (failure === null) {
    const amPeak = wk.am_peak
    const band: Band =
      amPeak !== null && amPeak <= FREQUENT_PEAK_THRESHOLD_MIN ? 'very_frequent' : 'frequent'
    return { band, ftn_qualifies: true, ftn_failure: null }
  }

  const allDay = wk.all_day
  const band: Band =
    allDay !== null && allDay <= STANDARD_THRESHOLD_MIN ? 'standard' : 'infrequent'
  return { band, ftn_qualifies: false, ftn_failure: failure }
}

interface PatternJudgement {
  band: Band
  ftn_qualifies: boolean
  ftn_failure: { day_type: DayType; hour: number } | null
  trip_share: number
}

// Band ordering: worst (most restrictive, least useful for riders) has the
// highest ordinal. Peak-only and night-only rank worse than any frequency
// ramp band — they mean "you can't just show up."
const BAND_ORDER: Record<Band, number> = {
  very_frequent: 0,
  frequent: 1,
  standard: 2,
  infrequent: 3,
  peak_only: 4,
  night_only: 5,
}

// Route band = band of the worst major pattern (≥20% of the route's trips).
// If no pattern is "major" (e.g. all patterns equally split), consider all.
// ftn_qualifies for the route iff the worst major pattern qualifies — one bad
// branch disqualifies the whole route.
export function routeBandFromPatterns(patterns: PatternJudgement[]): {
  band: Band
  ftn_qualifies: boolean
  ftn_failure: { day_type: DayType; hour: number } | null
} {
  if (patterns.length === 0) {
    return { band: 'infrequent', ftn_qualifies: false, ftn_failure: null }
  }
  const major = patterns.filter((p) => p.trip_share >= MAJOR_PATTERN_TRIP_SHARE)
  const toConsider = major.length > 0 ? major : patterns
  const worst = toConsider.reduce((acc, p) =>
    BAND_ORDER[p.band] > BAND_ORDER[acc.band] ? p : acc,
  )
  return {
    band: worst.band,
    ftn_qualifies: worst.band === 'very_frequent' || worst.band === 'frequent',
    ftn_failure: worst.ftn_failure,
  }
}
