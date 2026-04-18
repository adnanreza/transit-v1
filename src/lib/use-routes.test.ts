import { describe, expect, it } from 'vitest'
import { buildIndex, type LineFeature, type RoutesGeoJSON } from './use-routes'

function feature(
  route_id: string,
  route_short_name: string,
  coordinates: [number, number][],
  extras: Partial<LineFeature['properties']> = {},
): LineFeature {
  return {
    geometry: { type: 'LineString', coordinates },
    properties: {
      route_id,
      route_short_name,
      route_long_name: `${route_short_name} long name`,
      route_type: '3',
      route_color: '',
      ...extras,
    },
  }
}

function geojson(features: LineFeature[]): RoutesGeoJSON {
  return { features }
}

describe('buildIndex', () => {
  it('dedupes features by route_id and keeps each route once', () => {
    const result = buildIndex(
      geojson([
        feature('6699', '99', [[-123.1, 49.28]]),
        feature('6699', '99', [[-123.11, 49.28]]),
        feature('6614', '14', [[-123.05, 49.25]]),
      ]),
    )
    expect(result.map((r) => r.route_id)).toEqual(['6614', '6699'])
  })

  it('widens the bbox across every feature that shares a route_id', () => {
    const result = buildIndex(
      geojson([
        feature('6699', '99', [
          [-123.2, 49.25],
          [-123.1, 49.26],
        ]),
        feature('6699', '99', [
          [-123.05, 49.28],
          [-123.0, 49.30],
        ]),
      ]),
    )
    expect(result[0].bbox).toEqual([-123.2, 49.25, -123.0, 49.3])
  })

  it('sorts numeric short_names numerically before letter-prefixed ones', () => {
    const result = buildIndex(
      geojson([
        feature('a', 'N19', [[-123, 49]]),
        feature('b', '99', [[-123, 49]]),
        feature('c', 'R5', [[-123, 49]]),
        feature('d', '2', [[-123, 49]]),
      ]),
    )
    expect(result.map((r) => r.route_short_name)).toEqual(['2', '99', 'N19', 'R5'])
  })

  it('skips features with no route_id', () => {
    const result = buildIndex(
      geojson([
        { ...feature('1', '1', [[-123, 49]]) },
        { ...feature('' as string, '', [[-123, 49]]) },
      ]),
    )
    expect(result).toHaveLength(1)
    expect(result[0].route_id).toBe('1')
  })
})
