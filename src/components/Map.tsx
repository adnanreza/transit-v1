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
import { modeFilterExpression, type Mode } from '@/lib/modes'
import type { BandThresholds } from '@/lib/route-band'
import type { FocusRequest } from '@/App'
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
const ROUTE_LAYER_IDS = ['routes-lines-solid', 'routes-lines-dashed'] as const
const SELECTED_LAYER_ID = 'routes-lines-selected'
const HIGHLIGHT_HOLD_MS = 1200
const HIGHLIGHT_FADE_MS = 400
const SELECTED_MATCHES_NONE: FilterSpecification = [
  '==',
  ['get', 'route_id'],
  '',
]

const selectedLineWidth: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  2.5,
  13,
  5.5,
  16,
  9,
]

// Rapid transit (SkyTrain / SeaBus / WCE) keeps its GTFS `route_color` because
// those line colors are more recognizable to riders than a frequency band
// (they're all frequent anyway).
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
  thresholds: BandThresholds,
): ExpressionSpecification {
  return [
    'case',
    isBus,
    busColorExpression(frequencies, day, window, thresholds),
    rapidTransitColor,
  ]
}

function lineOpacity(
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
  thresholds: BandThresholds,
): ExpressionSpecification {
  return [
    'case',
    isBus,
    busOpacityExpression(frequencies, day, window, thresholds),
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

function buildBandFilters(frequencies: FrequenciesFile) {
  const dashedIdsFilter: FilterSpecification = [
    'in',
    ['get', 'route_id'],
    ['literal', dashedRouteIds(frequencies)],
  ]
  return {
    dashedIds: dashedIdsFilter,
    solidIds: ['!', dashedIdsFilter] as FilterSpecification,
  }
}

function composeFilter(
  bandFilter: FilterSpecification,
  enabledModes: ReadonlySet<Mode>,
): FilterSpecification {
  return ['all', bandFilter, modeFilterExpression(enabledModes)] as unknown as FilterSpecification
}

function addRouteLayers(
  map: maplibregl.Map,
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
  enabledModes: ReadonlySet<Mode>,
  thresholds: BandThresholds,
) {
  if (map.getLayer('routes-lines-solid')) return

  if (!map.getSource('routes')) {
    map.addSource('routes', { type: 'geojson', data: ROUTES_URL })
  }

  const bands = buildBandFilters(frequencies)
  const color = lineColor(frequencies, day, window, thresholds)
  const opacity = lineOpacity(frequencies, day, window, thresholds)

  // Dashed (peak-only / night-only) paints below so rapid transit and regular
  // buses overlay at geometry crossings.
  map.addLayer({
    id: 'routes-lines-dashed',
    type: 'line',
    source: 'routes',
    filter: composeFilter(bands.dashedIds, enabledModes),
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
    filter: composeFilter(bands.solidIds, enabledModes),
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

  // Highlight overlay painted last so the selected route sits above everything
  // else. Starts hidden; the focus effect below fills in the filter and pulses
  // the opacity when a route is selected.
  map.addLayer({
    id: SELECTED_LAYER_ID,
    type: 'line',
    source: 'routes',
    filter: SELECTED_MATCHES_NONE,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#ffffff',
      'line-width': selectedLineWidth,
      'line-opacity': 0,
      'line-opacity-transition': { duration: HIGHLIGHT_FADE_MS, delay: 0 },
    },
  })
}

function updateModeFilters(
  map: maplibregl.Map,
  frequencies: FrequenciesFile,
  enabledModes: ReadonlySet<Mode>,
) {
  if (!map.getLayer('routes-lines-solid')) return
  const bands = buildBandFilters(frequencies)
  map.setFilter('routes-lines-dashed', composeFilter(bands.dashedIds, enabledModes))
  map.setFilter('routes-lines-solid', composeFilter(bands.solidIds, enabledModes))
}

function repaintBands(
  map: maplibregl.Map,
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
  thresholds: BandThresholds,
) {
  if (!map.getLayer('routes-lines-solid')) return
  const color = lineColor(frequencies, day, window, thresholds)
  const opacity = lineOpacity(frequencies, day, window, thresholds)
  for (const id of ROUTE_LAYER_IDS) {
    map.setPaintProperty(id, 'line-color', color)
    map.setPaintProperty(id, 'line-opacity', opacity)
  }
}

interface Props {
  day: DayType
  window: TimeWindow
  enabledModes: ReadonlySet<Mode>
  thresholds: BandThresholds
  focusRequest: FocusRequest | null
}

export function Map({
  day,
  window,
  enabledModes,
  thresholds,
  focusRequest,
}: Props) {
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

  // Add the route layers once per (map, frequencies) — not on every control
  // change. Subsequent day/window/mode tweaks update paint or filter props in
  // the companion effects below without re-registering sources or layers.
  useEffect(() => {
    const map = mapRef.current
    if (!map || frequencies.status !== 'ready') return

    const apply = () =>
      addRouteLayers(map, frequencies.data, day, window, enabledModes, thresholds)
    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
    // day/window/enabledModes/thresholds intentionally omitted — this effect
    // seeds the initial state; live updates come from the repaint/filter
    // effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequencies])

  useEffect(() => {
    const map = mapRef.current
    if (!map || frequencies.status !== 'ready') return
    repaintBands(map, frequencies.data, day, window, thresholds)
  }, [frequencies, day, window, thresholds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || frequencies.status !== 'ready') return
    updateModeFilters(map, frequencies.data, enabledModes)
  }, [frequencies, enabledModes])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusRequest) return
    const [w, s, e, n] = focusRequest.route.bbox
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 80, duration: 600, maxZoom: 14 },
    )

    if (!map.getLayer(SELECTED_LAYER_ID)) return

    map.setFilter(SELECTED_LAYER_ID, [
      '==',
      ['get', 'route_id'],
      focusRequest.route.route_id,
    ])
    map.setPaintProperty(SELECTED_LAYER_ID, 'line-opacity', 0.85)

    const fadeTimer = setTimeout(() => {
      map.setPaintProperty(SELECTED_LAYER_ID, 'line-opacity', 0)
    }, HIGHLIGHT_HOLD_MS)

    const clearTimer = setTimeout(
      () => {
        if (!map.getLayer(SELECTED_LAYER_ID)) return
        map.setFilter(SELECTED_LAYER_ID, SELECTED_MATCHES_NONE)
      },
      HIGHLIGHT_HOLD_MS + HIGHLIGHT_FADE_MS + 100,
    )

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
    }
  }, [focusRequest])

  return <div ref={containerRef} className="h-full w-full" />
}
