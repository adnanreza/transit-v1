import type {
  Band,
  DayType,
  PatternFrequency,
  RouteFrequency,
  TimeWindow,
} from '../../scripts/types/frequencies'

export const MAJOR_PATTERN_TRIP_SHARE = 0.2

/**
 * Upper bounds (inclusive, in minutes) for each non-infrequent frequency band.
 * SPEC defaults; 06-controls lets the user adjust these while the map is live.
 * `infrequent` catches anything above `standard`, so it has no entry here.
 */
export interface BandThresholds {
  very_frequent: number
  frequent: number
  standard: number
}

export const DEFAULT_THRESHOLDS: BandThresholds = {
  very_frequent: 10,
  frequent: 15,
  standard: 30,
}

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
  thresholds: BandThresholds,
): 'very_frequent' | 'frequent' | 'standard' | 'infrequent' {
  if (headway <= thresholds.very_frequent) return 'very_frequent'
  if (headway <= thresholds.frequent) return 'frequent'
  if (headway <= thresholds.standard) return 'standard'
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
 *
 * `thresholds` defaults to SPEC values (10 / 15 / 30). The `06-controls` slider
 * passes user-picked values so the visual banding shifts live; the FTN
 * qualification flag on the route (route.band / ftn_qualifies) stays pinned
 * at the canonical SPEC definition and is not affected here.
 */
export function routeBandAt(
  route: RouteFrequency,
  day: DayType,
  window: TimeWindow,
  thresholds: BandThresholds = DEFAULT_THRESHOLDS,
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
    const band = bandFromHeadway(headway, thresholds)
    if (worst === null || FREQUENCY_BAND_RANK[band] > FREQUENCY_BAND_RANK[worst]) {
      worst = band
    }
  }
  return worst
}
