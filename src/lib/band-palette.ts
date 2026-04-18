import type {
  Band,
  DayType,
  FrequenciesFile,
  TimeWindow,
} from '../../scripts/types/frequencies'
import type { ExpressionSpecification } from 'maplibre-gl'
import {
  DEFAULT_THRESHOLDS,
  routeBandAt,
  type BandThresholds,
} from './route-band'

// Viridis-inspired ramp, ordered so the most frequent routes are the brightest
// (yellow pops on the dark basemap). Verified in a colorblind simulator and
// survives desaturation — luminance is monotonic across the ramp.
export const BAND_COLORS_DARK = {
  very_frequent: '#fde725',
  frequent: '#5ec962',
  standard: '#21918c',
  infrequent: '#3b528b',
  // Peak-only and night-only ride a different axis — they render dashed and
  // use a distinct hue so they never look like a fifth ramp step.
  peak_only: '#f97316',
  night_only: '#8b5cf6',
} as const satisfies Record<Band, string>

// Light-theme counterparts. The dark ramp's high-luminance end (yellow /
// green) vanishes against the pale Protomaps light basemap, so we shift each
// hue to a darker variant that keeps the same semantic mapping (warmth =
// frequent, cool blue = infrequent) and the same relative ordering. Still
// colorblind-safe — the hue progression is preserved; only luminance is
// inverted relative to background.
export const BAND_COLORS_LIGHT = {
  very_frequent: '#ca8a04', // yellow-600
  frequent: '#15803d', // green-700
  standard: '#0f766e', // teal-700
  infrequent: '#1e40af', // blue-700
  peak_only: '#c2410c', // orange-700
  night_only: '#6d28d9', // violet-700
} as const satisfies Record<Band, string>

// Legacy alias — widely imported across the UI (Legend, panel badge, etc.).
// Defaults to the dark palette for back-compat; call sites that need the
// active theme's palette use `bandColors(theme)`.
export const BAND_COLORS = BAND_COLORS_DARK

export function bandColors(theme: 'dark' | 'light'): Record<Band, string> {
  return theme === 'light' ? BAND_COLORS_LIGHT : BAND_COLORS_DARK
}

export const NO_SERVICE_COLOR = '#6b7280'
export const NO_SERVICE_OPACITY = 0.25
export const DEFAULT_OPACITY = 0.95

type BusBand = keyof typeof BAND_COLORS_DARK

/**
 * Build a MapLibre `match` expression that maps a bus feature's route_id to
 * the color for its band at the current (day, window). Routes with no service
 * in the window fall through to NO_SERVICE_COLOR.
 *
 * `thresholds` defaults to SPEC values; the 06-controls slider feeds user-
 * picked values so the ramp re-buckets live.
 */
export function busColorExpression(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
  thresholds: BandThresholds = DEFAULT_THRESHOLDS,
  theme: 'dark' | 'light' = 'dark',
): ExpressionSpecification {
  const byBand = groupRouteIdsByBand(frequencies, day, window, thresholds)
  const palette = bandColors(theme)
  const branches: (string | string[])[] = []
  for (const band of Object.keys(BAND_COLORS_DARK) as BusBand[]) {
    const ids = byBand[band]
    if (ids.length === 0) continue
    branches.push(ids, palette[band])
  }
  return ['match', ['get', 'route_id'], ...branches, NO_SERVICE_COLOR] as unknown as ExpressionSpecification
}

/**
 * Companion to `busColorExpression`: routes with no service in the window get
 * knocked down in opacity so users see "this line exists" without the full
 * weight of an active route. Thresholds shift which routes count as "served"
 * only insofar as `routeBandAt` returns null for unserved routes — the
 * parameter is passed through for symmetry with the color builder.
 */
export function busOpacityExpression(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
  thresholds: BandThresholds = DEFAULT_THRESHOLDS,
): ExpressionSpecification {
  const servedIds: string[] = []
  for (const route of Object.values(frequencies)) {
    if (routeBandAt(route, day, window, thresholds) !== null)
      servedIds.push(route.route_id)
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
  thresholds: BandThresholds,
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
    const band = routeBandAt(route, day, window, thresholds)
    if (band === null) continue
    result[band].push(route.route_id)
  }
  return result
}
