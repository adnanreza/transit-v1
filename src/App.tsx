import { lazy, Suspense, useState } from 'react'
import { FrequencyControls } from '@/components/FrequencyControls'
import { Legend } from '@/components/Legend'
import { ModeFilter } from '@/components/ModeFilter'
import { RouteSearch } from '@/components/RouteSearch'
import { ThresholdSlider } from '@/components/ThresholdSlider'
import {
  useDayType,
  useMapView,
  useModeFilter,
  useThresholds,
  useTimeWindow,
} from '@/lib/url-state'
import { useRoutes, type RouteIndexEntry } from '@/lib/use-routes'

// Code-split the map: maplibre-gl + pmtiles + protomaps-themes-base add up to
// ~300 KB gz on their own, which blows SPEC's 300 KB initial-JS budget. Load
// them only after the shell renders.
const Map = lazy(() =>
  import('@/components/Map').then((m) => ({ default: m.Map })),
)

export interface FocusRequest {
  route: RouteIndexEntry
  at: number
}

export default function App() {
  const [day, setDay] = useDayType()
  const [window, setWindow] = useTimeWindow()
  const [enabledModes, setEnabledModes] = useModeFilter()
  const [thresholds, setThresholds] = useThresholds()
  const [view, setView] = useMapView()
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const routes = useRoutes()

  return (
    <div className="dark relative h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Suspense fallback={<div className="h-full w-full" />}>
        <Map
          day={day}
          window={window}
          enabledModes={enabledModes}
          thresholds={thresholds}
          focusRequest={focusRequest}
          view={view}
          onViewChange={setView}
        />
      </Suspense>
      <footer className="pointer-events-none absolute inset-x-0 top-0 p-3 text-xs">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-col gap-1 rounded-md bg-neutral-950/80 px-3 py-2 text-neutral-300 shadow-lg ring-1 ring-white/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p>
              Route and arrival data used in this product or service is provided by permission of{' '}
              <a
                href="https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources"
                className="underline hover:text-neutral-100"
              >
                TransLink
              </a>
              .
            </p>
            <p className="text-neutral-500">
              TransLink assumes no responsibility for the accuracy or currency of the Data used in this product or service.
            </p>
            <p className="text-neutral-500">
              Map data ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                className="underline hover:text-neutral-300"
              >
                OpenStreetMap contributors
              </a>
              .
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/adnanreza/transit-v1"
              className="underline hover:text-neutral-100"
            >
              GitHub
            </a>
            <a
              href="https://github.com/adnanreza/transit-v1/blob/main/LICENSE"
              className="underline hover:text-neutral-100"
            >
              MIT
            </a>
          </div>
        </div>
      </footer>
      <div className="pointer-events-none absolute top-3 left-3">
        <RouteSearch
          routes={routes.status === 'ready' ? routes.routes : null}
          onSelect={(route) => setFocusRequest({ route, at: Date.now() })}
        />
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-2">
        <div className="pointer-events-auto flex w-72 flex-col gap-4 rounded-md bg-neutral-950/80 p-3 text-xs text-neutral-300 shadow-lg ring-1 ring-white/10 backdrop-blur">
          <ModeFilter enabled={enabledModes} onChange={setEnabledModes} />
          <ThresholdSlider thresholds={thresholds} onChange={setThresholds} />
        </div>
        <FrequencyControls
          day={day}
          window={window}
          onDayChange={setDay}
          onWindowChange={setWindow}
        />
      </div>
      <div className="pointer-events-none absolute bottom-12 right-3">
        <Legend thresholds={thresholds} />
      </div>
    </div>
  )
}
