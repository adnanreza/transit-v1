import { useEffect, useState } from 'react'

export interface RouteIndexEntry {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_type: string
  bbox: [number, number, number, number]
}

export type UseRoutesState =
  | { status: 'loading'; routes: null; error: null }
  | { status: 'ready'; routes: RouteIndexEntry[]; error: null }
  | { status: 'error'; routes: null; error: Error }

const ROUTES_URL = '/data/routes.geojson'

interface RouteFeatureProps {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_type: string
}

interface LineFeature {
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: RouteFeatureProps
}

interface RoutesGeoJSON {
  features: LineFeature[]
}

function buildIndex(geojson: RoutesGeoJSON): RouteIndexEntry[] {
  const byId = new Map<
    string,
    { meta: RouteFeatureProps; bbox: [number, number, number, number] }
  >()
  for (const feature of geojson.features) {
    const { route_id } = feature.properties
    if (!route_id) continue
    let entry = byId.get(route_id)
    if (!entry) {
      entry = {
        meta: feature.properties,
        bbox: [Infinity, Infinity, -Infinity, -Infinity],
      }
      byId.set(route_id, entry)
    }
    for (const [lon, lat] of feature.geometry.coordinates) {
      if (lon < entry.bbox[0]) entry.bbox[0] = lon
      if (lat < entry.bbox[1]) entry.bbox[1] = lat
      if (lon > entry.bbox[2]) entry.bbox[2] = lon
      if (lat > entry.bbox[3]) entry.bbox[3] = lat
    }
  }
  const out: RouteIndexEntry[] = []
  for (const [route_id, { meta, bbox }] of byId) {
    out.push({
      route_id,
      route_short_name: meta.route_short_name,
      route_long_name: meta.route_long_name,
      route_type: meta.route_type,
      bbox,
    })
  }
  // Stable short-name-first ordering helps the Command palette feel
  // predictable — numeric routes by number, letter routes (R*, N*) next.
  out.sort((a, b) => {
    const an = Number(a.route_short_name)
    const bn = Number(b.route_short_name)
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn
    if (Number.isFinite(an)) return -1
    if (Number.isFinite(bn)) return 1
    return a.route_short_name.localeCompare(b.route_short_name)
  })
  return out
}

export function useRoutes(): UseRoutesState {
  const [state, setState] = useState<UseRoutesState>({
    status: 'loading',
    routes: null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    fetch(ROUTES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`routes.geojson failed: ${r.status}`)
        return r.json() as Promise<RoutesGeoJSON>
      })
      .then((geojson) => {
        if (cancelled) return
        setState({ status: 'ready', routes: buildIndex(geojson), error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ status: 'error', routes: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
