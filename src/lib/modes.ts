import type { FilterSpecification } from 'maplibre-gl'

/**
 * User-facing transit modes, mapped to the GTFS `route_type` strings that
 * identify features in `routes.geojson`.
 *
 * GTFS values: '1' subway (SkyTrain), '2' rail (WCE), '3' bus, '4' ferry
 * (SeaBus).
 */
export type Mode = 'bus' | 'skytrain' | 'seabus' | 'wce'

export const MODES: Mode[] = ['bus', 'skytrain', 'seabus', 'wce']

export const MODE_LABELS: Record<Mode, string> = {
  bus: 'Bus',
  skytrain: 'SkyTrain',
  seabus: 'SeaBus',
  wce: 'WCE',
}

const MODE_TO_ROUTE_TYPES: Record<Mode, string[]> = {
  bus: ['3'],
  skytrain: ['1'],
  wce: ['2'],
  seabus: ['4'],
}

export function matchesModeFilter(
  routeType: string,
  enabled: ReadonlySet<Mode>,
): boolean {
  for (const mode of enabled) {
    if (MODE_TO_ROUTE_TYPES[mode].includes(routeType)) return true
  }
  return false
}

/**
 * Build a MapLibre `in`-expression filter matching features whose
 * `route_type` belongs to one of the enabled modes. Zero enabled modes
 * returns a filter that matches nothing — the user has opted out.
 */
export function modeFilterExpression(
  enabled: ReadonlySet<Mode>,
): FilterSpecification {
  const routeTypes = [...enabled].flatMap((m) => MODE_TO_ROUTE_TYPES[m])
  return ['in', ['get', 'route_type'], ['literal', routeTypes]]
}
