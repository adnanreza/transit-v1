import { Readable } from 'node:stream'
import { parse } from 'csv-parse/sync'
import { parse as parseStream } from 'csv-parse'

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

export interface TripRecord {
  trip_id: string
  route_id: string
  shape_id: string
  service_id: string
  direction_id: string
}

export function parseTrips(csv: string): TripRecord[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[]
  return rows.map((r) => ({
    trip_id: r.trip_id,
    route_id: r.route_id,
    shape_id: r.shape_id ?? '',
    service_id: r.service_id,
    direction_id: r.direction_id ?? '',
  }))
}

export function buildShapeToRouteMap(
  trips: TripRecord[],
  routes: RouteRecord[],
): Map<string, RouteRecord> {
  const routesById = new Map(routes.map((r) => [r.route_id, r]))
  const map = new Map<string, RouteRecord>()
  for (const t of trips) {
    if (!t.shape_id) continue
    const route = routesById.get(t.route_id)
    if (!route) continue
    if (!map.has(t.shape_id)) {
      map.set(t.shape_id, route)
    }
  }
  return map
}

export interface ShapePoint {
  lat: number
  lon: number
  seq: number
}

// Streaming parse of shapes.txt — collects only the shape_ids we care about
// (i.e. those that were mapped to a fixed-route by buildShapeToRouteMap).
export async function collectShapes(
  stream: Readable,
  includeShapeIds: Set<string>,
): Promise<Map<string, ShapePoint[]>> {
  const parser = stream.pipe(
    parseStream({ columns: true, skip_empty_lines: true, bom: true }),
  )
  const shapes = new Map<string, ShapePoint[]>()
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const shapeId = row.shape_id
    if (!includeShapeIds.has(shapeId)) continue
    const lat = parseFloat(row.shape_pt_lat)
    const lon = parseFloat(row.shape_pt_lon)
    const seq = parseInt(row.shape_pt_sequence, 10)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(seq)) continue
    let arr = shapes.get(shapeId)
    if (!arr) {
      arr = []
      shapes.set(shapeId, arr)
    }
    arr.push({ lat, lon, seq })
  }
  for (const arr of shapes.values()) {
    arr.sort((a, b) => a.seq - b.seq)
  }
  return shapes
}

export interface RouteFeature {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> }
  properties: {
    shape_id: string
    route_id: string
    route_short_name: string
    route_long_name: string
    route_type: string
    route_color: string
    route_text_color: string
  }
}

export interface RouteFeatureCollection {
  type: 'FeatureCollection'
  features: RouteFeature[]
}

export function shapesToRouteGeoJSON(
  shapes: Map<string, ShapePoint[]>,
  shapeToRoute: Map<string, RouteRecord>,
): RouteFeatureCollection {
  const features: RouteFeature[] = []
  for (const [shapeId, points] of shapes) {
    const route = shapeToRoute.get(shapeId)
    if (!route) continue
    if (points.length < 2) continue
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: points.map((p) => [p.lon, p.lat]),
      },
      properties: {
        shape_id: shapeId,
        route_id: route.route_id,
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
        route_type: route.route_type,
        route_color: route.route_color,
        route_text_color: route.route_text_color,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}
