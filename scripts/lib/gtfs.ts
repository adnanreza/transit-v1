import { parse } from 'csv-parse/sync'

export interface RouteRecord {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_type: string
  route_color: string
  route_text_color: string
  agency_id: string
}

export interface StopRecord {
  stop_id: string
  stop_name: string
  stop_lat: number
  stop_lon: number
  location_type: string
}

// GTFS Extended route type 715 = Demand and Response Bus Service.
// In TransLink's feed this is HandyDART — excluded per SPEC (not fixed-route).
const HANDYDART_ROUTE_TYPE = '715'

export function parseRoutes(csv: string): RouteRecord[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[]
  return rows.map((r) => ({
    route_id: r.route_id,
    route_short_name: r.route_short_name ?? '',
    route_long_name: r.route_long_name ?? '',
    route_type: r.route_type,
    route_color: r.route_color ?? '',
    route_text_color: r.route_text_color ?? '',
    agency_id: r.agency_id ?? '',
  }))
}

export function filterFixedRoutes(routes: RouteRecord[]): RouteRecord[] {
  return routes.filter((r) => r.route_type !== HANDYDART_ROUTE_TYPE)
}

export function parseStops(csv: string): StopRecord[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[]
  return rows
    .filter((r) => {
      const lt = r.location_type ?? ''
      return lt === '' || lt === '0'
    })
    .map((r) => ({
      stop_id: r.stop_id,
      stop_name: r.stop_name ?? '',
      stop_lat: parseFloat(r.stop_lat),
      stop_lon: parseFloat(r.stop_lon),
      location_type: r.location_type ?? '',
    }))
    .filter((s) => Number.isFinite(s.stop_lat) && Number.isFinite(s.stop_lon))
}

export interface StopFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { stop_id: string; stop_name: string }
}

export interface StopFeatureCollection {
  type: 'FeatureCollection'
  features: StopFeature[]
}

export function stopsToGeoJSON(stops: StopRecord[]): StopFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stops.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.stop_lon, s.stop_lat] },
      properties: { stop_id: s.stop_id, stop_name: s.stop_name },
    })),
  }
}
