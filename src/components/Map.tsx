import { useEffect, useMemo, useRef, useState } from 'react'
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
import { bandLabel } from '@/lib/band-label'
import { isTransitLayerOrderValid } from '@/lib/layer-stack'
import { modeFilterExpression, type Mode } from '@/lib/modes'
import { routeBandAt, type BandThresholds } from '@/lib/route-band'
import { viewsDiffer, type MapView } from '@/lib/url-state'
import { RouteTooltip } from '@/components/RouteTooltip'
import type { FocusRequest } from '@/App'
import type {
  DayType,
  FrequenciesFile,
  TimeWindow,
} from '../../scripts/types/frequencies'
import 'maplibre-gl/dist/maplibre-gl.css'
const ROUTES_URL = '/data/routes.geojson'
const STOPS_URL = '/data/stops.geojson'
const STOPS_LAYER_ID = 'stops-circles'
const FALLBACK_ROUTE_COLOR = '#888888'
const ROUTE_LAYER_IDS = ['routes-lines-solid', 'routes-lines-dashed'] as const
const SELECTED_LAYER_ID = 'routes-lines-selected'

// Bottom-up z-order for the transit layers this component manages. Stops sit
// under the route lines so route-hover hit priority wins near a stop; the
// selected-route overlay sits on top so its pulse reads through everything.
// Used as the source of truth for the dev-mode z-order assertion below.
const TRANSIT_LAYER_STACK = [
  STOPS_LAYER_ID,
  'routes-lines-dashed',
  'routes-lines-solid',
  SELECTED_LAYER_ID,
] as const
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

// Radius grows with zoom so stops read as anchor points at street zoom
// without dominating the view as soon as they become visible. Below z13 the
// stops layer is hidden entirely — at network-overview zooms the colored
// route lines tell the FTN story, and ~9k dots would just add noise.
const stopCircleRadius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  13,
  1.5,
  15,
  2.5,
  17,
  4,
]

// Stops paint below routes so route-hover / route-click hit priority wins
// when a cursor lands on a route that runs past a stop. Add this layer before
// any of the route layers so the MapLibre z-order matches.
function addStopsLayer(map: maplibregl.Map) {
  if (map.getLayer(STOPS_LAYER_ID)) return
  if (!map.getSource('stops')) {
    map.addSource('stops', { type: 'geojson', data: STOPS_URL })
  }
  map.addLayer({
    id: STOPS_LAYER_ID,
    type: 'circle',
    source: 'stops',
    minzoom: 13,
    paint: {
      'circle-color': '#d4d4d4',
      'circle-opacity': 0.85,
      'circle-radius': stopCircleRadius,
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1,
    },
  })
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

  addStopsLayer(map)

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

  assertTransitLayerOrder(map)
}

// Dev-only tripwire: flags if someone later reorders the addLayer calls and
// breaks the stops-below-routes-below-selected invariant that 09's
// hit-priority promise depends on. Silent in production builds.
function assertTransitLayerOrder(map: maplibregl.Map) {
  if (!import.meta.env.DEV) return
  const styleLayerIds = map.getStyle().layers.map((l) => l.id)
  if (isTransitLayerOrderValid(styleLayerIds, TRANSIT_LAYER_STACK)) return
  console.warn(
    'Transit layer z-order out of spec. Expected bottom-up:',
    TRANSIT_LAYER_STACK,
    '; got:',
    styleLayerIds.filter((id) =>
      (TRANSIT_LAYER_STACK as readonly string[]).includes(id),
    ),
  )
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
  view: MapView
  selectedRouteId: string | null
  onViewChange: (view: MapView) => void
  onRouteSelect: (routeId: string) => void
  onBackgroundClick: () => void
}

interface HoverState {
  routeId: string
  shortName: string
  longName: string
  x: number
  y: number
}

export function Map({
  day,
  window,
  enabledModes,
  thresholds,
  focusRequest,
  view,
  selectedRouteId,
  onViewChange,
  onRouteSelect,
  onBackgroundClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const frequencies = useFrequencies()
  const [hover, setHover] = useState<HoverState | null>(null)

  // Stash the latest writers + the last view we applied so the map-event
  // handlers (registered once at init) always see the current React values
  // without re-registering on every prop change.
  const onViewChangeRef = useRef(onViewChange)
  const onRouteSelectRef = useRef(onRouteSelect)
  const onBackgroundClickRef = useRef(onBackgroundClick)
  const selectedRouteIdRef = useRef(selectedRouteId)
  const lastAppliedViewRef = useRef(view)
  useEffect(() => {
    onViewChangeRef.current = onViewChange
    onRouteSelectRef.current = onRouteSelect
    onBackgroundClickRef.current = onBackgroundClick
    selectedRouteIdRef.current = selectedRouteId
  })

  useEffect(() => {
    if (!containerRef.current) return

    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(getPmtilesUrl()),
      center: view.center,
      zoom: view.zoom,
    })
    mapRef.current = map

    const handleMoveEnd = () => {
      const c = map.getCenter()
      const next: MapView = {
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
      }
      lastAppliedViewRef.current = next
      onViewChangeRef.current(next)
    }
    map.on('moveend', handleMoveEnd)

    // Single click handler: a hit on a rendered route layer selects that
    // route; anything else (base map, stop, water) is treated as a background
    // click so the panel can close. queryRenderedFeatures respects layer
    // filters, so mode-hidden routes are already excluded.
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [...ROUTE_LAYER_IDS],
      })
      const routeId = features[0]?.properties?.route_id
      if (typeof routeId === 'string' && routeId.length > 0) {
        onRouteSelectRef.current(routeId)
      } else {
        onBackgroundClickRef.current()
      }
    }
    map.on('click', handleClick)

    // Hover: only register on devices that actually support a hover cursor.
    // Touch-only browsers still fire mousemove during pan gestures, which
    // would light up the tooltip mid-swipe. (hover: hover) correctly rules
    // those out while leaving desktop mice and trackpads in.
    const supportsHover =
      globalThis.matchMedia?.('(hover: hover)').matches ?? false

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      // Panel-open suppresses hover entirely — the highlight layer shows the
      // selected route, and the user's attention is on the panel, not the map.
      if (selectedRouteIdRef.current) return
      const features = map.queryRenderedFeatures(e.point, {
        layers: [...ROUTE_LAYER_IDS],
      })
      const top = features[0]
      if (!top) {
        setHover(null)
        map.getCanvas().style.cursor = ''
        return
      }
      const p = top.properties ?? {}
      const routeId = typeof p.route_id === 'string' ? p.route_id : ''
      if (!routeId) {
        setHover(null)
        map.getCanvas().style.cursor = ''
        return
      }
      map.getCanvas().style.cursor = 'pointer'
      setHover({
        routeId,
        shortName: typeof p.route_short_name === 'string' ? p.route_short_name : '',
        longName: typeof p.route_long_name === 'string' ? p.route_long_name : '',
        x: e.point.x,
        y: e.point.y,
      })
    }

    const handleMouseLeave = () => {
      setHover(null)
      map.getCanvas().style.cursor = ''
    }

    if (supportsHover) {
      map.on('mousemove', handleMouseMove)
      map.on('mouseout', handleMouseLeave)
    }

    return () => {
      map.off('moveend', handleMoveEnd)
      map.off('click', handleClick)
      if (supportsHover) {
        map.off('mousemove', handleMouseMove)
        map.off('mouseout', handleMouseLeave)
      }
      map.remove()
      maplibregl.removeProtocol('pmtiles')
      mapRef.current = null
    }
    // View intentionally read only for the initial camera — subsequent
    // updates flow through the sync effect below, not a re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // URL-driven view sync. When the view prop diverges materially from the
  // map's current camera (user navigated back/forward, pasted a permalink,
  // etc.), ease to it. The drift threshold plus the lastAppliedView ref
  // together prevent the moveend → setUrl → prop → ease feedback loop.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!viewsDiffer(view, lastAppliedViewRef.current)) return
    lastAppliedViewRef.current = view
    map.easeTo({ center: view.center, zoom: view.zoom, duration: 600 })
  }, [view])

  // Panel-open hides the hover tooltip + highlight per SPEC — the selection
  // is the story while the sheet is visible. Derive during render rather than
  // clearing hover state in an effect; any stale hover will be overwritten on
  // the next mousemove once the panel closes.
  const visibleHover = useMemo(
    () => (selectedRouteId ? null : hover),
    [selectedRouteId, hover],
  )

  // Imperatively reset the cursor when the panel opens with the mouse still
  // over a route; a re-entry mousemove after close will reapply it.
  useEffect(() => {
    if (!selectedRouteId) return
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
  }, [selectedRouteId])

  // visibleHover → sustained highlight on the existing routes-lines-selected
  // layer. No fade timer; clears when the cursor leaves the route. Search-pulse
  // and this effect both write the same paint props — if they collide, the
  // last write wins, which is the behavior we want (user is currently
  // interacting with whichever one moved more recently).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer(SELECTED_LAYER_ID)) return
    if (visibleHover) {
      map.setFilter(SELECTED_LAYER_ID, [
        '==',
        ['get', 'route_id'],
        visibleHover.routeId,
      ])
      map.setPaintProperty(SELECTED_LAYER_ID, 'line-opacity', 0.85)
    } else {
      map.setPaintProperty(SELECTED_LAYER_ID, 'line-opacity', 0)
      map.setFilter(SELECTED_LAYER_ID, SELECTED_MATCHES_NONE)
    }
  }, [visibleHover])

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

  // Tooltip content: band label reflects the current day/window/thresholds.
  // `No service` if the route has no service in the selected window.
  let tooltipBandLabel = 'No service'
  if (visibleHover && frequencies.status === 'ready') {
    const route = frequencies.data[visibleHover.routeId]
    if (route) {
      const band = routeBandAt(route, day, window, thresholds)
      if (band) tooltipBandLabel = bandLabel(band, thresholds)
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {visibleHover && (
        <RouteTooltip
          x={visibleHover.x}
          y={visibleHover.y}
          shortName={visibleHover.shortName}
          longName={visibleHover.longName}
          bandLabel={tooltipBandLabel}
        />
      )}
    </div>
  )
}
