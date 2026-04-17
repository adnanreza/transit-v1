import { useEffect, useRef } from 'react'
import maplibregl, {
  type ExpressionSpecification,
  type FilterSpecification,
} from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { buildMapStyle, getPmtilesUrl } from '@/lib/map-style'
import { useFrequencies } from '@/lib/frequencies'
import type { FrequenciesFile } from '../../scripts/types/frequencies'
import 'maplibre-gl/dist/maplibre-gl.css'

const INITIAL_CENTER: [number, number] = [-123.05, 49.25]
const INITIAL_ZOOM = 10
const ROUTES_URL = '/data/routes.geojson'
const FALLBACK_ROUTE_COLOR = '#888888'

function dashedRouteIds(frequencies: FrequenciesFile): string[] {
  return Object.values(frequencies)
    .filter((r) => r.band === 'peak_only' || r.band === 'night_only')
    .map((r) => r.route_id)
}

function addRouteLayers(map: maplibregl.Map, frequencies: FrequenciesFile) {
  if (map.getLayer('routes-lines-solid')) return

  if (!map.getSource('routes')) {
    map.addSource('routes', { type: 'geojson', data: ROUTES_URL })
  }

  // GTFS route_type: '3' = bus, '1' = subway/SkyTrain, '2' = rail/WCE,
  // '4' = ferry/SeaBus. Rapid transit is thicker and painted on top.
  const isBus: ExpressionSpecification = ['==', ['get', 'route_type'], '3']

  const colorExpression: ExpressionSpecification = [
    'case',
    ['==', ['get', 'route_color'], ''],
    FALLBACK_ROUTE_COLOR,
    ['concat', '#', ['get', 'route_color']],
  ]

  const widthExpression: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    9,
    ['case', isBus, 0.75, 2],
    13,
    ['case', isBus, 2, 4.5],
    16,
    ['case', isBus, 3.5, 7],
  ]

  const dashedFilter: FilterSpecification = [
    'in',
    ['get', 'route_id'],
    ['literal', dashedRouteIds(frequencies)],
  ]
  const solidFilter: FilterSpecification = ['!', dashedFilter]

  // Dashed (peak-only / night-only) goes below so rapid transit and regular
  // buses paint over it where geometries overlap — the same rule we already
  // follow within the solid layer via line-sort-key.
  map.addLayer({
    id: 'routes-lines-dashed',
    type: 'line',
    source: 'routes',
    filter: dashedFilter,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': colorExpression,
      'line-width': widthExpression,
      'line-dasharray': [2, 2],
    },
  })

  map.addLayer({
    id: 'routes-lines-solid',
    type: 'line',
    source: 'routes',
    filter: solidFilter,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
      'line-sort-key': ['case', isBus, 0, 1],
    },
    paint: {
      'line-color': colorExpression,
      'line-width': widthExpression,
    },
  })
}

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const frequencies = useFrequencies()

  useEffect(() => {
    if (!containerRef.current) return

    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(getPmtilesUrl()),
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })
    mapRef.current = map

    return () => {
      map.remove()
      maplibregl.removeProtocol('pmtiles')
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || frequencies.status !== 'ready') return

    const apply = () => addRouteLayers(map, frequencies.data)
    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  }, [frequencies])

  return <div ref={containerRef} className="h-full w-full" />
}
