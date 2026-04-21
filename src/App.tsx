import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AboutButton } from '@/components/AboutButton'
import { AboutSheet } from '@/components/AboutSheet'
import { FrequencyControls } from '@/components/FrequencyControls'
import { Legend } from '@/components/Legend'
import { ModeFilter } from '@/components/ModeFilter'
import { RouteSearch } from '@/components/RouteSearch'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ThresholdSlider } from '@/components/ThresholdSlider'
import { useFrequencies } from '@/lib/frequencies'
import {
  useDayType,
  useMapView,
  useModeFilter,
  useResolvedTheme,
  useSelectedRoute,
  useTheme,
  useThresholds,
  useTimeWindow,
  useUrlStateCleanup,
} from '@/lib/url-state'
import { useRoutes, type RouteIndexEntry } from '@/lib/use-routes'

// Code-split the map: maplibre-gl + pmtiles + protomaps-themes-base add up to
// ~300 KB gz on their own, which blows SPEC's 300 KB initial-JS budget. Load
// them only after the shell renders.
const Map = lazy(() =>
  import('@/components/Map').then((m) => ({ default: m.Map })),
)

// Lazy-load the panel + its chart so Recharts stays out of the initial bundle.
// Only paid-for when the user clicks a route (or opens with ?route=…).
const RouteDetailPanel = lazy(() => import('@/components/RouteDetailPanel'))

export interface FocusRequest {
  route: RouteIndexEntry
  at: number
}

export default function App() {
  const frequencies = useFrequencies()
  const knownRouteIds = useMemo(() => {
    if (frequencies.status !== 'ready') return null
    return new Set(Object.keys(frequencies.data))
  }, [frequencies])
  useUrlStateCleanup(knownRouteIds)
  const [day, setDay] = useDayType()
  const [window, setWindow] = useTimeWindow()
  const [enabledModes, setEnabledModes] = useModeFilter()
  const [thresholds, setThresholds] = useThresholds()
  const [view, setView] = useMapView()
  const [themePref, setThemePref] = useTheme()
  const resolvedTheme = useResolvedTheme()
  const [selectedRouteId, setSelectedRouteId] = useSelectedRoute()
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const routes = useRoutes()

  // Only one side sheet at a time — stacking them creates dead space and
  // confuses users who can't see both states at once.
  const openAbout = () => {
    setAboutOpen(true)
    if (selectedRouteId) setSelectedRouteId(null)
  }
  const openRoute = (id: string) => {
    setSelectedRouteId(id)
    if (aboutOpen) setAboutOpen(false)
  }

  // Initial ?route=<id> → pan to bbox once routes load. Later clicks don't
  // re-pan (they just open the panel), so this fires a single time. Routes
  // load async, so this can't be a lazy useState initializer; a one-shot
  // effect gated by a ref is the natural fit.
  const deepLinkHandledRef = useRef(false)
  useEffect(() => {
    if (deepLinkHandledRef.current) return
    if (routes.status !== 'ready') return
    deepLinkHandledRef.current = true
    if (!selectedRouteId) return
    const entry = routes.routes.find((r) => r.route_id === selectedRouteId)
    // Stable sentinel for `at`: the deep-link fires exactly once, and
    // subsequent RouteSearch picks will produce distinct Date.now() values.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (entry) setFocusRequest({ route: entry, at: 0 })
  }, [routes, selectedRouteId])

  return (
    <div
      className={`${resolvedTheme === 'dark' ? 'dark' : ''} relative h-screen w-screen overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100`}
    >
      <Suspense fallback={<div className="h-full w-full" />}>
        <Map
          day={day}
          window={window}
          enabledModes={enabledModes}
          thresholds={thresholds}
          focusRequest={focusRequest}
          view={view}
          selectedRouteId={selectedRouteId}
          theme={resolvedTheme}
          onViewChange={setView}
          onRouteSelect={openRoute}
          onBackgroundClick={() => setSelectedRouteId(null)}
        />
      </Suspense>
      <div className="pointer-events-none absolute top-3 left-3">
        <RouteSearch
          routes={routes.status === 'ready' ? routes.routes : null}
          frequencies={frequencies.status === 'ready' ? frequencies.data : null}
          onSelect={(route) => {
            if (aboutOpen) setAboutOpen(false)
            setFocusRequest({ route, at: Date.now() })
          }}
        />
      </div>
      {/* Bottom bar — controls strip on top, footer underneath, stacked in a
          single absolutely-positioned column so the footer can't get covered
          by a tall controls card on narrow viewports. */}
      <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex flex-col gap-1.5">
        <div className="pointer-events-auto flex flex-wrap items-start gap-x-5 gap-y-3 rounded-md bg-white/85 px-4 py-3 text-xs text-neutral-800 shadow-lg ring-1 ring-black/10 backdrop-blur dark:bg-neutral-950/85 dark:text-neutral-200 dark:ring-white/10">
          <FrequencyControls
            day={day}
            window={window}
            onDayChange={setDay}
            onWindowChange={setWindow}
          />
          <ModeFilter enabled={enabledModes} onChange={setEnabledModes} />
          <div className="min-w-[14rem] flex-1">
            <ThresholdSlider
              thresholds={thresholds}
              theme={resolvedTheme}
              onChange={setThresholds}
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <Legend thresholds={thresholds} theme={resolvedTheme} />
          </div>
        </div>
        <footer className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-2 text-[11px] leading-tight text-neutral-600 dark:text-neutral-400">
          <span>
            Route data provided by permission of{' '}
            <a
              href="https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources"
              className="underline hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              TransLink
            </a>
            .
          </span>
          <span>
            Map ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              OpenStreetMap contributors
            </a>
            .
          </span>
          <span>
            <a
              href="https://github.com/adnanreza/transit-v1"
              className="underline hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              GitHub
            </a>{' '}·{' '}
            <a
              href="https://github.com/adnanreza/transit-v1/blob/main/LICENSE"
              className="underline hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              MIT
            </a>
          </span>
        </footer>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2">
        <AboutButton onClick={openAbout} />
        <ThemeToggle pref={themePref} onChange={setThemePref} />
      </div>
      <Suspense fallback={null}>
        <RouteDetailPanel
          routeId={selectedRouteId}
          frequencies={
            frequencies.status === 'ready' ? frequencies.data : null
          }
          routes={routes.status === 'ready' ? routes.routes : null}
          day={day}
          window={window}
          thresholds={thresholds}
          theme={resolvedTheme}
          onClose={() => setSelectedRouteId(null)}
        />
      </Suspense>
      <AboutSheet open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}
