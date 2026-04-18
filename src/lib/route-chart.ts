import type {
  DayType,
  PatternFrequency,
  RouteFrequency,
} from '../../scripts/types/frequencies'
import { MAJOR_PATTERN_TRIP_SHARE } from './route-band'

export const CHART_HOURS = Array.from({ length: 16 }, (_, i) => 6 + i)

export interface HourlyPoint {
  hour: number
  headway: number | null
}

function isMajor(pattern: PatternFrequency): boolean {
  return pattern.trip_share >= MAJOR_PATTERN_TRIP_SHARE
}

/**
 * One day-type series for the panel chart. At each hour in 06:00–21:00, picks
 * the *worst* (largest) headway across the route's major patterns — same
 * semantics that drive the map color and FTN qualification. Returns null for
 * hours where no major pattern has a scheduled headway, so the chart can
 * leave those points gapped rather than drawing misleading zero values.
 */
export function hourlyChartSeries(
  route: RouteFrequency,
  day: DayType,
): HourlyPoint[] {
  return CHART_HOURS.map((hour) => {
    let worst: number | null = null
    for (const pattern of route.patterns) {
      if (!isMajor(pattern)) continue
      const h = pattern.hourly[day]?.[String(hour)]
      if (h == null) continue
      if (worst === null || h > worst) worst = h
    }
    return { hour, headway: worst }
  })
}

/**
 * Largest non-null headway across all three day-type series for a route.
 * Used to pick a shared y-axis domain so small multiples are comparable at a
 * glance, and to anchor the 15-min reference line without clipping.
 */
export function maxSeriesHeadway(
  series: HourlyPoint[][],
  floor = 30,
): number {
  let max = floor
  for (const s of series) {
    for (const { headway } of s) {
      if (headway != null && headway > max) max = headway
    }
  }
  return max
}
