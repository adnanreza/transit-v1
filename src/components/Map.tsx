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
import { displayShortName } from '@/lib/route-search'
import { useStopRoutesIndex } from '@/lib/stop-routes'
import { StopPopup } from '@/components/StopPopup'
import { useRoutes } from '@/lib/use-routes'
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
const RAPID_CASING_LAYER_ID = 'routes-lines-rapid-casing'
const FALLBACK_ROUTE_COLOR = '#888888'
const ROUTE_LAYER_IDS = ['routes-lines-solid', 'routes-lines-dashed'] as const
const SELECTED_LAYER_ID = 'routes-lines-selected'

// Bottom-up z-order for the transit layers this component manages. Stops at
// the bottom; rapid-transit casing is next so the halo reads behind the brand
// color paint above; bus route layers stack on top; the selected-route
// overlay sits above everything so its pulse reads through the map. Source
// of truth for the dev-mode z-order assertion below.
const TRANSIT_LAYER_STACK = [
  STOPS_LAYER_ID,
  RAPID_CASING_LAYER_ID,
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
  theme: 'dark' | 'light',
): ExpressionSpecification {
  return [
    'case',
    isBus,
    busColorExpression(frequencies, day, window, thresholds, theme),
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

// Casing width tracks the rapid transit body width + ~3px extra at each zoom
// so the halo is visible on both sides without overwhelming the brand color.
const rapidCasingWidth: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  4,
  13,
  7.5,
  16,
  10,
]

// White casing for rapid transit against the dark basemap, near-black against
// the light basemap. The halo makes Expo Line blue, Canada Line teal, and
// Millennium Line yellow readable against colored base-map terrain AND
// distinguishable from same-hue bus band colors at a glance — classic
// transit-map styling (think London Tube).
const RAPID_CASING_COLOR: Record<'dark' | 'light', string> = {
  dark: '#ffffff',
  light: '#0a0a0a',
}

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
// without dominating the view as soon as they become visible. At z11 stops
// come in as tiny specks — enough to ground the map with physical anchor
// points without swamping the color-coded route lines. Below z11 the stops
// layer is hidden entirely: at network-overview zooms the colored route
// lines tell the FTN story, and ~9k dots would just add noise.
const stopCircleRadius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  11,
  0.75,
  13,
  1.5,
  15,
  2.5,
  17,
  4,
]

// Stop-circle colors per theme. Dark-bg: muted off-white fill on a dark
// hairline stroke. Light-bg: inverted — dark slate fill on a light hairline.
// The inversion keeps the dot legible against whichever route color passes
// near it at crossings (yellow, teal, etc.) on either background tone.
const STOP_FILL: Record<'dark' | 'light', string> = {
  dark: '#d4d4d4',
  light: '#404040',
}
const STOP_STROKE: Record<'dark' | 'light', string> = {
  dark: '#0a0a0a',
  light: '#f5f5f5',
}
const SELECTED_HIGHLIGHT: Record<'dark' | 'light', string> = {
  dark: '#ffffff',
  light: '#0a0a0a',
}

// Stops paint below routes so route-hover / route-click hit priority wins
// when a cursor lands on a route that runs past a stop. Add this layer before
// any of the route layers so the MapLibre z-order matches.
function addStopsLayer(map: maplibregl.Map, theme: 'dark' | 'light') {
  if (map.getLayer(STOPS_LAYER_ID)) return
  if (!map.getSource('stops')) {
    map.addSource('stops', { type: 'geojson', data: STOPS_URL })
  }
  map.addLayer({
    id: STOPS_LAYER_ID,
    type: 'circle',
    source: 'stops',
    minzoom: 11,
    paint: {
      'circle-color': STOP_FILL[theme],
      'circle-opacity': 0.85,
      'circle-radius': stopCircleRadius,
      'circle-stroke-color': STOP_STROKE[theme],
      // No stroke below z13 — at z11–12 the dots are under 1.5 px and a
      // 1 px outline would dominate the fill, smudging stops into a halo
      // instead of reading as discrete points.
      'circle-stroke-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        11,
        0,
        13,
        1,
      ],
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
  theme: 'dark' | 'light',
) {
  if (map.getLayer('routes-lines-solid')) return

  if (!map.getSource('routes')) {
    map.addSource('routes', { type: 'geojson', data: ROUTES_URL })
  }

  addStopsLayer(map, theme)

  // Rapid-transit casing. Only non-bus route_types pass the filter; the mode
  // filter is composed in so SkyTrain / SeaBus / WCE toggles hide the casing
  // in lockstep with the colored line above.
  map.addLayer({
    id: RAPID_CASING_LAYER_ID,
    type: 'line',
    source: 'routes',
    filter: [
      'all',
      ['!', isBus],
      modeFilterExpression(enabledModes),
    ] as unknown as FilterSpecification,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': RAPID_CASING_COLOR[theme],
      'line-opacity': 0.9,
      'line-width': rapidCasingWidth,
    },
  })

  const bands = buildBandFilters(frequencies)
  const color = lineColor(frequencies, day, window, thresholds, theme)
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
      'line-color': SELECTED_HIGHLIGHT[theme],
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
  // Rapid-transit casing tracks the mode filter so toggling SkyTrain / SeaBus /
  // WCE hides the halo in lockstep with the colored line above.
  map.setFilter(
    RAPID_CASING_LAYER_ID,
    ['all', ['!', isBus], modeFilterExpression(enabledModes)] as unknown as FilterSpecification,
  )
}

function repaintBands(
  map: maplibregl.Map,
  frequencies: FrequenciesFile,
  day: DayType,
  window: TimeWindow,
  thresholds: BandThresholds,
  theme: 'dark' | 'light',
) {
  if (!map.getLayer('routes-lines-solid')) return
  const color = lineColor(frequencies, day, window, thresholds, theme)
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
  theme: 'dark' | 'light'
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

interface StopPopupState {
  stopId: string
  stopName: string
  stopCode: string
  lng: number
  lat: number
}

export function Map({
  day,
  window,
  enabledModes,
  thresholds,
  focusRequest,
  view,
  selectedRouteId,
  theme,
  onViewChange,
  onRouteSelect,
  onBackgroundClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const frequencies = useFrequencies()
  const routes = useRoutes()
  const [hover, setHover] = useState<HoverState | null>(null)
  const [stopPopup, setStopPopup] = useState<StopPopupState | null>(null)
  const [stopPopupScreen, setStopPopupScreen] = useState<{
    x: number
    y: number
  } | null>(null)
  const stopRoutesIndex = useStopRoutesIndex(stopPopup !== null)
  const stopPopupRef = useRef(stopPopup)

  // Mirror the latest stopPopup into a ref so map-event handlers (registered
  // once at init) always see the current value without re-registering.
  useEffect(() => {
    stopPopupRef.current = stopPopup
  }, [stopPopup])

  // A stop popup and a route-detail sheet shouldn't coexist — selecting a
  // route (including by clicking a badge in the popup) closes the popup.
  useEffect(() => {
    // Syncing local popup state to an external selection signal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedRouteId) setStopPopup(null)
  }, [selectedRouteId])

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
      style: buildMapStyle(getPmtilesUrl(), theme),
      center: view.center,
      zoom: view.zoom,
      // Our footer carries both OSM + TransLink attribution; MapLibre's
      // built-in "MapLibre | © OpenStreetMap" badge is redundant and
      // visually competes with the footer for the same credit.
      attributionControl: false,
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

    // Click hit-priority: a rendered route layer wins first, so clicking a
    // route line that runs past a stop still opens the route panel (continues
    // feature 09's convention). If no route is under the cursor, fall through
    // to the stops layer and open the stop popup. Only if neither hits does
    // this become a background click.
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const routeHits = map.queryRenderedFeatures(e.point, {
        layers: [...ROUTE_LAYER_IDS],
      })
      const routeId = routeHits[0]?.properties?.route_id
      if (typeof routeId === 'string' && routeId.length > 0) {
        setStopPopup(null)
        onRouteSelectRef.current(routeId)
        return
      }
      const stopHits = map.getLayer(STOPS_LAYER_ID)
        ? map.queryRenderedFeatures(e.point, { layers: [STOPS_LAYER_ID] })
        : []
      const stopFeature = stopHits[0]
      if (stopFeature && stopFeature.geometry.type === 'Point') {
        const p = stopFeature.properties ?? {}
        const stopId = typeof p.stop_id === 'string' ? p.stop_id : ''
        if (stopId) {
          const [lng, lat] = stopFeature.geometry.coordinates as [
            number,
            number,
          ]
          setStopPopup({
            stopId,
            stopName: typeof p.stop_name === 'string' ? p.stop_name : 'Stop',
            stopCode: typeof p.stop_code === 'string' ? p.stop_code : '',
            lng,
            lat,
          })
          setStopPopupScreen({ x: e.point.x, y: e.point.y })
          return
        }
      }
      setStopPopup(null)
      onBackgroundClickRef.current()
    }
    map.on('click', handleClick)

    // Reproject the popup anchor as the map pans or zooms so the popup
    // stays glued to its stop. If the stop scrolls out of the padded
    // viewport, close the popup — mirrors Google/Apple Maps behavior and
    // avoids arrow-only popups hanging off the map edges.
    const handleMapMove = () => {
      const current = stopPopupRef.current
      if (!current) return
      const pt = map.project([current.lng, current.lat])
      const { clientWidth: w, clientHeight: h } = map.getContainer()
      const pad = 48
      if (pt.x < -pad || pt.x > w + pad || pt.y < -pad || pt.y > h + pad) {
        setStopPopup(null)
        setStopPopupScreen(null)
        return
      }
      setStopPopupScreen({ x: pt.x, y: pt.y })
    }
    map.on('move', handleMapMove)

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
        shortName:
          typeof p.route_short_name === 'string'
            ? displayShortName(p.route_short_name)
            : '',
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
      map.off('move', handleMapMove)
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
      addRouteLayers(map, frequencies.data, day, window, enabledModes, thresholds, theme)
    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
    }
    // day/window/enabledModes/thresholds/theme intentionally omitted — this
    // effect seeds the initial state; live updates come from the repaint /
    // filter / theme-swap effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequencies])

  useEffect(() => {
    const map = mapRef.current
    if (!map || frequencies.status !== 'ready') return
    repaintBands(map, frequencies.data, day, window, thresholds, theme)
  }, [frequencies, day, window, thresholds, theme])

  useEffect(() => {
    const map = mapRef.current
    if (!map || frequencies.status !== 'ready') return
    updateModeFilters(map, frequencies.data, enabledModes)
  }, [frequencies, enabledModes])

  // Theme swap: regenerate the basemap style and re-add our route/stops/
  // selected layers after it loads. `setStyle({ diff: true })` preserves the
  // geojson sources (no re-fetch of routes/stops) but drops user-added layers,
  // so we explicitly reinstall them on the `style.load` event. Skipped on
  // initial mount — the map is already initialized with the current theme.
  const prevThemeRef = useRef(theme)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (prevThemeRef.current === theme) return
    prevThemeRef.current = theme

    map.setStyle(buildMapStyle(getPmtilesUrl(), theme), { diff: true })
    map.once('style.load', () => {
      if (frequencies.status !== 'ready') return
      addRouteLayers(map, frequencies.data, day, window, enabledModes, thresholds, theme)
    })
    // day / window / enabledModes / thresholds intentionally omitted —
    // repaint/filter effects below reconcile those independently after the
    // style swap. Only theme transitions should trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

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
    // MapLibre's own stylesheet applies `.maplibregl-map { position: relative }`
    // with higher specificity than Tailwind utilities, which kills any
    // `absolute inset-0` we try to hang on the container itself — the element
    // collapses to height 0. Size the container via `h-full w-full` instead,
    // and keep the tooltip as a positioned sibling inside this wrapper.
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {visibleHover && (
        <RouteTooltip
          x={visibleHover.x}
          y={visibleHover.y}
          shortName={visibleHover.shortName}
          longName={visibleHover.longName}
          bandLabel={tooltipBandLabel}
        />
      )}
      {stopPopup && stopPopupScreen && (
        <StopPopup
          x={stopPopupScreen.x}
          y={stopPopupScreen.y}
          stopName={stopPopup.stopName}
          stopCode={stopPopup.stopCode}
          stopId={stopPopup.stopId}
          stopRoutesState={stopRoutesIndex}
          routes={routes.status === 'ready' ? routes.routes : null}
          onRouteSelect={(routeId) => {
            setStopPopup(null)
            onRouteSelect(routeId)
          }}
          onClose={() => setStopPopup(null)}
        />
      )}
    </div>
  )
}
