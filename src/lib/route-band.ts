import type {
  Band,
  DayType,
  PatternFrequency,
  RouteFrequency,
  TimeWindow,
} from '../../scripts/types/frequencies'

export const MAJOR_PATTERN_TRIP_SHARE = 0.2

// Worse = more infrequent. The route's band at a window is the worst band
// among its major patterns, so comparisons need a total order.
const FREQUENCY_BAND_RANK: Record<
  'very_frequent' | 'frequent' | 'standard' | 'infrequent',
  number
> = {
  very_frequent: 0,
  frequent: 1,
  standard: 2,
  infrequent: 3,
}

function bandFromHeadway(
  headway: number,
): 'very_frequent' | 'frequent' | 'standard' | 'infrequent' {
  if (headway <= 10) return 'very_frequent'
  if (headway <= 15) return 'frequent'
  if (headway <= 30) return 'standard'
  return 'infrequent'
}

function isMajor(pattern: PatternFrequency): boolean {
  return pattern.trip_share >= MAJOR_PATTERN_TRIP_SHARE
}

/**
 * Resolve the band a route should render as for a given (day_type, time_window).
 *
 * - `peak_only` / `night_only` are global route classifications and ignore the
 *   window selection (dashed rendering in both cases).
 * - Otherwise, look at major patterns (trip_share >= 0.2): each pattern's band
 *   at the window is derived from its headway; the route takes the worst.
 * - If no major pattern has service in the window (all headways null), returns
 *   `null` so the UI can render the route as "off-duty".
 */
export function routeBandAt(
  route: RouteFrequency,
  day: DayType,
  window: TimeWindow,
): Band | null {
  if (route.band === 'peak_only' || route.band === 'night_only') {
    return route.band
  }

  let worst: 'very_frequent' | 'frequent' | 'standard' | 'infrequent' | null =
    null
  for (const pattern of route.patterns) {
    if (!isMajor(pattern)) continue
    const headway = pattern.headways[day]?.[window]
    if (headway == null) continue
    const band = bandFromHeadway(headway)
    if (worst === null || FREQUENCY_BAND_RANK[band] > FREQUENCY_BAND_RANK[worst]) {
      worst = band
    }
  }
  return worst
}
