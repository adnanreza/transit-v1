import type { DayType, TimeWindow } from '../types/frequencies.ts'

// Parse a GTFS time string (HH:MM:SS, HH may be ≥ 24 for post-midnight trips)
// to seconds from midnight of the service day. Returns -1 for invalid input.
export function parseGtfsTime(s: string): number {
  const m = s.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (!m) return -1
  const h = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const ss = parseInt(m[3], 10)
  if (!Number.isFinite(h) || !Number.isFinite(mm) || !Number.isFinite(ss)) return -1
  return h * 3600 + mm * 60 + ss
}

// Time windows as [startSec, endSec) ranges. `all_day` is a catch-all.
// `late_night` spans the midnight boundary and is handled with a bespoke
// predicate so it can accept both 22:00–23:59 on the service day AND both
// 00:00–05:59 (if the schedule truly starts fresh) AND 24:00–29:59
// (post-midnight GTFS times).
export const TIME_WINDOW_RANGES: Record<
  Exclude<TimeWindow, 'all_day' | 'late_night'>,
  [number, number]
> = {
  am_peak: [6 * 3600, 9 * 3600],
  midday: [9 * 3600, 15 * 3600],
  pm_peak: [15 * 3600, 18 * 3600],
  evening: [18 * 3600, 22 * 3600],
}

export function isInLateNight(timeSec: number): boolean {
  // same-day 22:00–24:00, next-day GTFS 24:00–30:00, or early-morning 00:00–06:00
  return (
    (timeSec >= 22 * 3600 && timeSec < 24 * 3600) ||
    (timeSec >= 24 * 3600 && timeSec < 30 * 3600) ||
    (timeSec >= 0 && timeSec < 6 * 3600)
  )
}

// Median gap between consecutive timestamps in seconds. Null if fewer than
// two timestamps (a headway needs two trips to exist).
export function medianHeadwaySeconds(timesSeconds: number[]): number | null {
  if (timesSeconds.length < 2) return null
  const sorted = [...timesSeconds].sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1])
  }
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid]
}

// Median headway in *minutes* for each time window, across the supplied
// arrival times. Null = no service in that window (0 or 1 trip).
export function computeHeadwaysForWindows(
  times: number[],
): Record<TimeWindow, number | null> {
  const sToMin = (s: number | null): number | null => (s === null ? null : s / 60)
  const inRange = (start: number, end: number): number[] =>
    times.filter((t) => t >= start && t < end)

  return {
    all_day: sToMin(medianHeadwaySeconds(times)),
    am_peak: sToMin(medianHeadwaySeconds(inRange(...TIME_WINDOW_RANGES.am_peak))),
    midday: sToMin(medianHeadwaySeconds(inRange(...TIME_WINDOW_RANGES.midday))),
    pm_peak: sToMin(medianHeadwaySeconds(inRange(...TIME_WINDOW_RANGES.pm_peak))),
    evening: sToMin(medianHeadwaySeconds(inRange(...TIME_WINDOW_RANGES.evening))),
    late_night: sToMin(medianHeadwaySeconds(times.filter(isInLateNight))),
  }
}

// Hourly median headway, keyed by hour "6".."21". Trip at 07:15 → bucket "7";
// trip at 25:30 is post-midnight, modulo 24 → 1 → not in any FTN bucket.
// These are the exact buckets the FTN rule checks against.
export function computeHourlyHeadways(times: number[]): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (let h = 6; h <= 21; h++) {
    const inHour = times.filter((t) => Math.floor((t % (24 * 3600)) / 3600) === h)
    const m = medianHeadwaySeconds(inHour)
    result[String(h)] = m === null ? null : m / 60
  }
  return result
}

export interface PatternTimes {
  weekday: number[]
  saturday: number[]
  sunday: number[]
}

// Given trips bucketed by day type → arrival times (seconds from midnight),
// compute headways per day type.
export function computePatternFrequencies(times: PatternTimes): {
  headways: Record<DayType, Record<TimeWindow, number | null>>
  hourly: Record<DayType, Record<string, number | null>>
} {
  return {
    headways: {
      weekday: computeHeadwaysForWindows(times.weekday),
      saturday: computeHeadwaysForWindows(times.saturday),
      sunday: computeHeadwaysForWindows(times.sunday),
    },
    hourly: {
      weekday: computeHourlyHeadways(times.weekday),
      saturday: computeHourlyHeadways(times.saturday),
      sunday: computeHourlyHeadways(times.sunday),
    },
  }
}
