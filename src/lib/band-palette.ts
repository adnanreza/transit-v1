import type {
  Band,
  DayType,
  FrequenciesFile,
  TimeWindow,
} from '../../scripts/types/frequencies'
import type { ExpressionSpecification } from 'maplibre-gl'
import { routeBandAt } from './route-band'

// Viridis-inspired ramp, ordered so the most frequent routes are the brightest
// (yellow pops on the dark basemap). Verified in a colorblind simulator and
// survives desaturation — luminance is monotonic across the ramp.
export const BAND_COLORS = {
  very_frequent: '#fde725',
  frequent: '#5ec962',
  standard: '#21918c',
  infrequent: '#3b528b',
  // Peak-only and night-only ride a different axis — they render dashed and
  // use a distinct hue so they never look like a fifth ramp step.
  peak_only: '#f97316',
  night_only: '#8b5cf6',
} as const satisfies Record<Band, string>

export const NO_SERVICE_COLOR = '#6b7280'
export const NO_SERVICE_OPACITY = 0.25
export const DEFAULT_OPACITY = 0.95

type BusBand = keyof typeof BAND_COLORS

/**
 * Build a MapLibre `match` expression that maps a bus feature's route_id to
 * the color for its band at the current (day, window). Routes with no service
 * in the window fall through to NO_SERVICE_COLOR.
 */
export function busColorExpression(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
): ExpressionSpecification {
  const byBand = groupRouteIdsByBand(frequencies, day, window)
  const branches: (string | string[])[] = []
  for (const band of Object.keys(BAND_COLORS) as BusBand[]) {
    const ids = byBand[band]
    if (ids.length === 0) continue
    branches.push(ids, BAND_COLORS[band])
  }
  return ['match', ['get', 'route_id'], ...branches, NO_SERVICE_COLOR] as unknown as ExpressionSpecification
}

/**
 * Companion to `busColorExpression`: routes with no service in the window get
 * knocked down in opacity so users see "this line exists" without the full
 * weight of an active route.
 */
export function busOpacityExpression(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
): ExpressionSpecification {
  const servedIds: string[] = []
  for (const route of Object.values(frequencies)) {
    if (routeBandAt(route, day, window) !== null) servedIds.push(route.route_id)
  }
  if (servedIds.length === 0) {
    return ['literal', NO_SERVICE_OPACITY] as unknown as ExpressionSpecification
  }
  return ['match', ['get', 'route_id'], servedIds, DEFAULT_OPACITY, NO_SERVICE_OPACITY] as unknown as ExpressionSpecification
}

function groupRouteIdsByBand(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
): Record<BusBand, string[]> {
  const result: Record<BusBand, string[]> = {
    very_frequent: [],
    frequent: [],
    standard: [],
    infrequent: [],
    peak_only: [],
    night_only: [],
  }
  for (const route of Object.values(frequencies)) {
    const band = routeBandAt(route, day, window)
    if (band === null) continue
    result[band].push(route.route_id)
  }
  return result
}
