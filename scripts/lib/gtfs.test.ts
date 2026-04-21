import { describe, it, expect } from 'vitest'
import {
  buildShapeToRouteMap,
  filterFixedRoutes,
  parseAgencies,
  parseRoutes,
  parseStops,
  parseTrips,
  shapesToRouteGeoJSON,
  stopsToGeoJSON,
  type RouteRecord,
  type ShapePoint,
} from './gtfs.ts'

describe('parseAgencies', () => {
  it('parses agency.txt into records keyed by header name', () => {
    const csv =
      'agency_id,agency_name,agency_url,agency_timezone,agency_lang\n' +
      'TL,TransLink,https://translink.ca,America/Vancouver,en\n'
    const agencies = parseAgencies(csv)
    expect(agencies).toHaveLength(1)
    expect(agencies[0]).toEqual({ agency_id: 'TL', agency_name: 'TransLink' })
  })

  it('defaults missing agency_id / agency_name to empty strings', () => {
    // GTFS allows agency_id to be omitted in single-agency feeds; our
    // pipeline should still produce an empty-string agency_id so Map lookups
    // collapse the record to a predictable key.
    const csv =
      'agency_name,agency_url,agency_timezone\n' +
      'TransLink,https://translink.ca,America/Vancouver\n'
    const agencies = parseAgencies(csv)
    expect(agencies[0].agency_id).toBe('')
    expect(agencies[0].agency_name).toBe('TransLink')
  })

  it('returns an empty list for an agency.txt with only a header row', () => {
    const csv = 'agency_id,agency_name\n'
    expect(parseAgencies(csv)).toEqual([])
  })
})

describe('parseRoutes', () => {
  it('parses a routes.txt CSV into RouteRecord[] keyed by header, not column order', () => {
    // Intentionally reorders columns and includes one extra TransLink-specific column
    // (route_url) to confirm parsing is header-based and tolerant of extras.
    const csv =
      'route_long_name,route_url,route_type,route_color,agency_id,route_id,route_short_name,route_text_color\n' +
      'Hastings St,https://example,3,008522,TL,37807,R5,FFFFFF\n' +
      'Expo Line,https://example,1,0033a0,TL,30053,,FFFFFF\n'
    const routes = parseRoutes(csv)
    expect(routes).toHaveLength(2)
    expect(routes[0]).toMatchObject({
      route_id: '37807',
      route_short_name: 'R5',
      route_long_name: 'Hastings St',
      route_type: '3',
      route_color: '008522',
      agency_id: 'TL',
    })
    expect(routes[1].route_short_name).toBe('') // missing value defaults to empty string
  })
})

describe('filterFixedRoutes', () => {
  const base = {
    route_short_name: '',
    route_long_name: '',
    route_color: '',
    route_text_color: '',
    agency_id: 'TL',
  }
  it('excludes route_type 715 (HandyDART / Demand and Response) and keeps everything else', () => {
    const routes: RouteRecord[] = [
      { ...base, route_id: '1', route_type: '3' }, // bus
      { ...base, route_id: '2', route_type: '1' }, // subway
      { ...base, route_id: '3', route_type: '4' }, // ferry
      { ...base, route_id: '4', route_type: '715' }, // HandyDART
    ]
    expect(filterFixedRoutes(routes).map((r) => r.route_id)).toEqual(['1', '2', '3'])
  })
})

describe('parseStops', () => {
  it('drops location_type 1 (stations) and rows with invalid lat/lon', () => {
    const csv =
      'stop_id,stop_name,stop_lat,stop_lon,location_type\n' +
      '1,Platform A,49.28,-123.11,0\n' + // keep
      '2,Platform B,49.29,-123.12,\n' + // keep (empty location_type → default 0)
      '3,Parent Station,49.30,-123.13,1\n' + // drop (station)
      '4,Broken Lat,not-a-number,-123.14,0\n' // drop (NaN)
    const stops = parseStops(csv)
    expect(stops.map((s) => s.stop_id)).toEqual(['1', '2'])
    expect(stops[0].stop_lat).toBeCloseTo(49.28, 2)
  })

  it('carries stop_code through when present and falls back to empty string', () => {
    const csv =
      'stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type\n' +
      '1,50123,Main & 1st,49.28,-123.11,0\n' +
      '2,,Main & 2nd,49.29,-123.12,0\n'
    const stops = parseStops(csv)
    expect(stops[0].stop_code).toBe('50123')
    expect(stops[1].stop_code).toBe('')
  })

  it('tolerates a GTFS feed without the optional stop_code column', () => {
    const csv =
      'stop_id,stop_name,stop_lat,stop_lon,location_type\n' +
      '1,Main & 1st,49.28,-123.11,0\n'
    const stops = parseStops(csv)
    expect(stops[0].stop_code).toBe('')
  })
})

describe('stopsToGeoJSON', () => {
  it('emits Point features with stop_id, stop_code, and stop_name in properties', () => {
    const fc = stopsToGeoJSON([
      {
        stop_id: '1',
        stop_code: '50123',
        stop_name: 'Main & 1st',
        stop_lat: 49.28,
        stop_lon: -123.11,
        location_type: '0',
      },
    ])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(1)
    const f = fc.features[0]
    expect(f.geometry.coordinates).toEqual([-123.11, 49.28])
    expect(f.properties).toEqual({
      stop_id: '1',
      stop_code: '50123',
      stop_name: 'Main & 1st',
    })
  })
})

describe('parseTrips', () => {
  it('parses trips with missing optional fields', () => {
    const csv =
      'route_id,service_id,trip_id,shape_id,direction_id,trip_headsign\n' +
      'R5,MON,t1,s1,0,Downtown\n' +
      'R5,MON,t2,,1,Return\n' // missing shape_id
    const trips = parseTrips(csv)
    expect(trips).toHaveLength(2)
    expect(trips[0].shape_id).toBe('s1')
    expect(trips[1].shape_id).toBe('')
  })
})

describe('buildShapeToRouteMap', () => {
  const makeRoute = (id: string): RouteRecord => ({
    route_id: id,
    route_short_name: id,
    route_long_name: '',
    route_type: '3',
    route_color: '',
    route_text_color: '',
    agency_id: 'TL',
  })

  it('maps each shape_id to its first-seen route and only to routes in the given set', () => {
    const routes = [makeRoute('R5')] // R9 intentionally absent
    const trips = [
      { trip_id: 't1', route_id: 'R5', shape_id: 's1', service_id: 'M', direction_id: '0' },
      { trip_id: 't2', route_id: 'R5', shape_id: 's2', service_id: 'M', direction_id: '1' },
      { trip_id: 't3', route_id: 'R9', shape_id: 's3', service_id: 'M', direction_id: '0' }, // unknown route
      { trip_id: 't4', route_id: 'R5', shape_id: '', service_id: 'M', direction_id: '0' }, // no shape
    ]
    const map = buildShapeToRouteMap(trips, routes)
    expect([...map.keys()].sort()).toEqual(['s1', 's2'])
    expect(map.get('s1')?.route_id).toBe('R5')
  })
})

describe('shapesToRouteGeoJSON', () => {
  const makeRoute = (id: string): RouteRecord => ({
    route_id: id,
    route_short_name: id,
    route_long_name: 'Long',
    route_type: '3',
    route_color: 'ABCDEF',
    route_text_color: 'FFFFFF',
    agency_id: 'TL',
  })

  it('emits one LineString per mapped shape with ≥2 points; skips everything else', () => {
    const points: ShapePoint[] = [
      { lat: 49.28, lon: -123.11, seq: 1 },
      { lat: 49.29, lon: -123.12, seq: 2 },
    ]
    const shapes = new Map<string, ShapePoint[]>([
      ['s1', points],
      ['s2', [{ lat: 0, lon: 0, seq: 1 }]], // <2 points → skipped
      ['s3', points], // unmapped → skipped
    ])
    const shapeToRoute = new Map<string, RouteRecord>([['s1', makeRoute('R5')]])

    const fc = shapesToRouteGeoJSON(shapes, shapeToRoute)
    expect(fc.features).toHaveLength(1)
    const f = fc.features[0]
    expect(f.properties.shape_id).toBe('s1')
    expect(f.properties.route_id).toBe('R5')
    expect(f.geometry.coordinates).toEqual([
      [-123.11, 49.28],
      [-123.12, 49.29],
    ])
  })
})
