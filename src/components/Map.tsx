import { useEffect, useRef } from 'react'
import maplibregl, {
  type ExpressionSpecification,
  type FilterSpecification,
} from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { buildMapStyle, getPmtilesUrl } from '@/lib/map-style'
import { useFrequencies } from '@/lib/frequencies'
import {
  busColorExpression,
  busOpacityExpression,
  DEFAULT_OPACITY,
} from '@/lib/band-palette'
import type {
  DayType,
  FrequenciesFile,
  TimeWindow,
} from '../../scripts/types/frequencies'
import 'maplibre-gl/dist/maplibre-gl.css'

const INITIAL_CENTER: [number, number] = [-123.05, 49.25]
const INITIAL_ZOOM = 10
const ROUTES_URL = '/data/routes.geojson'
const FALLBACK_ROUTE_COLOR = '#888888'

// Rapid transit (SkyTrain / SeaBus / WCE) keeps its GTFS `route_color` because
// those line colors are more recognizable to riders than a frequency band
// (they're all frequent anyway). The color expression below applies only to
// buses; the full paint uses a case on route_type to pick which one to use.
const rapidTransitColor: ExpressionSpecification = [
  'case',
  ['==', ['get', 'route_color'], ''],
  FALLBACK_ROUTE_COLOR,
  ['concat', '#', ['get', 'route_color']],
]

// GTFS route_type: '3' = bus, everything else rapid transit here.
const isBus: ExpressionSpecification = ['==', ['get', 'route_type'], '3']

function dashedRouteIds(frequencies: FrequenciesFile): string[] {
  return Object.values(frequencies)
    .filter((r) => r.band === 'peak_only' || r.band === 'night_only')
    .map((r) => r.route_id)
}

function lineColor(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
): ExpressionSpecification {
  return [
    'case',
    isBus,
    busColorExpression(frequencies, day, window),
    rapidTransitColor,
  ]
}

function lineOpacity(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
): ExpressionSpecification {
  return [
    'case',
    isBus,
    busOpacityExpression(frequencies, day, window),
    DEFAULT_OPACITY,
  ]
}

const lineWidth: ExpressionSpecification = [
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

function addRouteLayers(
  map: maplibregl.Map,
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
) {
  if (map.getLayer('routes-lines-solid')) return

  if (!map.getSource('routes')) {
    map.addSource('routes', { type: 'geojson', data: ROUTES_URL })
  }

  const dashedFilter: FilterSpecification = [
    'in',
    ['get', 'route_id'],
    ['literal', dashedRouteIds(frequencies)],
  ]
  const solidFilter: FilterSpecification = ['!', dashedFilter]

  const color = lineColor(frequencies, day, window)
  const opacity = lineOpacity(frequencies, day, window)

  // Dashed (peak-only / night-only) paints below so rapid transit and regular
  // buses overlay at geometry crossings.
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
      'line-color': color,
      'line-opacity': opacity,
      'line-width': lineWidth,
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
      'line-color': color,
      'line-opacity': opacity,
      'line-width': lineWidth,
    },
  })
}

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const frequencies = useFrequencies()

  // Day type + time window selection. Hard-coded defaults for now — goal 5
  // wires this to user-facing toggles.
  const day: DayType = 'weekday'
  const window: TimeWindow = 'all_day'

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

    const apply = () => addRouteLayers(map, frequencies.data, day, window)
    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
  }, [frequencies, day, window])

  return <div ref={containerRef} className="h-full w-full" />
}
