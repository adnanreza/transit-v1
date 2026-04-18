import {
  createParser,
  parseAsFloat,
  parseAsStringLiteral,
  useQueryState,
  type Options,
} from 'nuqs'
import { useCallback, useEffect, useMemo } from 'react'
import { MODES, type Mode } from './modes'
import { DEFAULT_THRESHOLDS, type BandThresholds } from './route-band'
import type { DayType, TimeWindow } from '../../scripts/types/frequencies'

export const DAY_TYPES = ['weekday', 'saturday', 'sunday'] as const satisfies DayType[]
export const TIME_WINDOWS = [
  'all_day',
  'am_peak',
  'midday',
  'pm_peak',
  'evening',
  'late_night',
] as const satisfies TimeWindow[]

// Shared options: default-omission so bare-root URLs stay clean, push-history
// for discrete toggles so back/forward step through user choices (slider /
// map-view hooks override to replace in their own modules).
const DISCRETE_OPTIONS = {
  clearOnDefault: true,
  history: 'push',
} as const satisfies Options

export const dayTypeParser = parseAsStringLiteral(DAY_TYPES)
  .withDefault('weekday')
  .withOptions(DISCRETE_OPTIONS)

export const timeWindowParser = parseAsStringLiteral(TIME_WINDOWS)
  .withDefault('all_day')
  .withOptions(DISCRETE_OPTIONS)

export function useDayType() {
  return useQueryState('d', dayTypeParser)
}

export function useTimeWindow() {
  return useQueryState('w', timeWindowParser)
}

// Every mode enabled, in alphabetical order — matches the serialized form a
// user-saved "all on" state would round-trip to, so clearOnDefault can strip
// the param when the user lands back at the default.
const MODES_SORTED_ALL = [...MODES].sort() as Mode[]

// parseAsArrayOf by itself returns [] for an all-invalid list, which would
// leave the user with zero modes visible instead of the expected default. Wrap
// it so empty and malformed lists both route through the default fallback.
export const modeListParser = createParser<Mode[]>({
  parse: (value) => {
    const tokens = value.split(',')
    const valid = tokens.filter((t): t is Mode =>
      (MODES as readonly string[]).includes(t),
    )
    return valid.length === 0 ? null : valid
  },
  serialize: (modes) => [...modes].sort().join(','),
  eq: (a, b) => {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((v, i) => v === sortedB[i])
  },
})
  .withDefault(MODES_SORTED_ALL)
  .withOptions(DISCRETE_OPTIONS)

export function useModeFilter(): [
  ReadonlySet<Mode>,
  (next: Set<Mode>) => void,
] {
  const [arr, setArr] = useQueryState('m', modeListParser)

  const enabled = useMemo(() => new Set(arr), [arr])

  const setEnabled = useCallback(
    (next: Set<Mode>) => {
      // Sort on write so URLs round-trip to the same string regardless of
      // the order the user toggled chips.
      setArr([...next].sort() as Mode[])
    },
    [setArr],
  )

  return [enabled, setEnabled]
}

const MIN_THRESHOLD = 1
const MAX_THRESHOLD = 60

// Slider drag emits many intermediate states per second. Replace semantics
// keep the back button useful — one entry per sustained control use, not one
// per pixel of drag.
const CONTINUOUS_OPTIONS = {
  clearOnDefault: true,
  history: 'replace',
} as const satisfies Options

export const thresholdsParser = createParser<BandThresholds>({
  parse: (value) => {
    const parts = value.split(',')
    if (parts.length !== 3) return null
    const nums = parts.map(Number)
    if (
      !nums.every(
        (n) =>
          Number.isFinite(n) && n >= MIN_THRESHOLD && n <= MAX_THRESHOLD,
      )
    ) {
      return null
    }
    const [vf, f, s] = nums
    // Monotonic — the slider enforces this in the UI, but the URL is
    // user-editable, so validate on parse.
    if (!(vf < f && f < s)) return null
    return { very_frequent: vf, frequent: f, standard: s }
  },
  serialize: ({ very_frequent, frequent, standard }) =>
    `${very_frequent},${frequent},${standard}`,
  eq: (a, b) =>
    a.very_frequent === b.very_frequent &&
    a.frequent === b.frequent &&
    a.standard === b.standard,
})
  .withDefault(DEFAULT_THRESHOLDS)
  .withOptions(CONTINUOUS_OPTIONS)

export function useThresholds() {
  return useQueryState('t', thresholdsParser)
}

// Metro Vancouver default view, matched by the Map component at init.
export const INITIAL_CENTER: [number, number] = [-123.05, 49.25]
export const INITIAL_ZOOM = 10

// Drift thresholds for the loop-prevention check when URL-driven view values
// arrive at the Map. Roughly ~11 m in lat/lon and ~1% of a zoom level — small
// enough that programmatic round-trips (easeTo → moveend → setUrl → easeTo)
// terminate on the first pass.
export const VIEW_DRIFT_LON_LAT = 0.0001
export const VIEW_DRIFT_ZOOM = 0.01

const round = (n: number, places: number) =>
  Math.round(n * 10 ** places) / 10 ** places

export const centerParser = createParser<[number, number]>({
  parse: (value) => {
    const parts = value.split(',').map(Number)
    if (parts.length !== 2) return null
    const [lon, lat] = parts
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
    return [lon, lat]
  },
  serialize: ([lon, lat]) => `${round(lon, 4)},${round(lat, 4)}`,
  eq: (a, b) => a[0] === b[0] && a[1] === b[1],
})
  .withDefault(INITIAL_CENTER)
  .withOptions(CONTINUOUS_OPTIONS)

const zoomParser = parseAsFloat
  .withDefault(INITIAL_ZOOM)
  .withOptions(CONTINUOUS_OPTIONS)

export interface MapView {
  center: [number, number]
  zoom: number
}

/**
 * Decide whether a new view should trigger a camera ease. Used by Map's
 * URL → camera sync effect to terminate the moveend → setUrl → view-prop →
 * easeTo loop: our own writes round-trip to the same view and get filtered
 * out here. Returns true only when at least one dimension exceeds its drift
 * threshold.
 */
export function viewsDiffer(a: MapView, b: MapView): boolean {
  return (
    Math.abs(a.center[0] - b.center[0]) >= VIEW_DRIFT_LON_LAT ||
    Math.abs(a.center[1] - b.center[1]) >= VIEW_DRIFT_LON_LAT ||
    Math.abs(a.zoom - b.zoom) >= VIEW_DRIFT_ZOOM
  )
}

/**
 * Strip URL params that nuqs couldn't parse so the address bar matches what
 * the user actually sees on the map. nuqs falls back to the default value
 * silently when a parser returns null, but leaves the malformed key in place;
 * a permalink like `?t=30,15,10` (non-monotonic) would otherwise persist in
 * the bar even though the app ignores it. Runs once on mount.
 *
 * Valid params are never touched here — `clearOnDefault` handles stripping
 * default values on subsequent setter calls.
 */
export function useUrlStateCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const removed: string[] = []
    const entries: Array<[string, { parse: (s: string) => unknown }]> = [
      ['d', dayTypeParser],
      ['w', timeWindowParser],
      ['m', modeListParser],
      ['t', thresholdsParser],
      ['c', centerParser],
    ]
    for (const [key, parser] of entries) {
      const value = url.searchParams.get(key)
      if (value === null) continue
      if (parser.parse(value) !== null) continue
      url.searchParams.delete(key)
      removed.push(key)
    }
    if (removed.length > 0) {
      console.warn(
        `Ignoring malformed URL param${removed.length > 1 ? 's' : ''}: ${removed.join(', ')}`,
      )
      window.history.replaceState(window.history.state, '', url)
    }
  }, [])
}

export function useMapView(): [MapView, (next: MapView) => void] {
  const [center, setCenter] = useQueryState('c', centerParser)
  const [zoom, setZoom] = useQueryState('z', zoomParser)

  const view = useMemo<MapView>(() => ({ center, zoom }), [center, zoom])

  const setView = useCallback(
    (next: MapView) => {
      setCenter([round(next.center[0], 4), round(next.center[1], 4)])
      setZoom(round(next.zoom, 2))
    },
    [setCenter, setZoom],
  )

  return [view, setView]
}
