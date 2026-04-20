import { useEffect, useRef, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { RouteFrequencyChart } from '@/components/RouteFrequencyChart'
import { bandColors } from '@/lib/band-palette'
import { bandLabel } from '@/lib/band-label'
import { formatFtnFailure } from '@/lib/ftn-format'
import { routeBandAt, type BandThresholds } from '@/lib/route-band'
import { hourlyChartSeries } from '@/lib/route-chart'
import {
  countMinorPatterns,
  majorPatternsSorted,
  normalizePatternTermini,
} from '@/lib/route-patterns'
import type { RouteIndexEntry } from '@/lib/use-routes'
import type {
  DayType,
  FrequenciesFile,
  RouteFrequency,
  TimeWindow,
} from '../../scripts/types/frequencies'

interface RouteDetailPanelProps {
  routeId: string | null
  frequencies: FrequenciesFile | null
  routes: RouteIndexEntry[] | null
  day: DayType
  window: TimeWindow
  thresholds: BandThresholds
  theme: 'dark' | 'light'
  onClose: () => void
}

// GTFS route_type '3' is bus; the rest (0/1/2/4/…) are rapid transit or
// non-bus modes that keep their branded GTFS route_color in the UI.
const BUS_ROUTE_TYPE = '3'

function badgeColor(
  entry: RouteIndexEntry,
  route: RouteFrequency,
  day: DayType,
  win: TimeWindow,
  thresholds: BandThresholds,
  theme: 'dark' | 'light',
): string {
  if (entry.route_type !== BUS_ROUTE_TYPE && entry.route_color) {
    return `#${entry.route_color}`
  }
  const band = routeBandAt(route, day, win, thresholds) ?? route.band
  return bandColors(theme)[band] ?? '#525252'
}

export default function RouteDetailPanel({
  routeId,
  frequencies,
  routes,
  day,
  window,
  thresholds,
  theme,
  onClose,
}: RouteDetailPanelProps) {
  // Keep the last-known routeId around during the closing animation so the
  // panel doesn't go blank as it slides out. Use the derive-during-render
  // pattern — no effect needed, since we only need to mirror non-null values.
  const [displayedId, setDisplayedId] = useState<string | null>(routeId)
  if (routeId !== null && routeId !== displayedId) {
    setDisplayedId(routeId)
  }

  const route =
    displayedId && frequencies ? (frequencies[displayedId] ?? null) : null
  const entry =
    displayedId && routes
      ? (routes.find((r) => r.route_id === displayedId) ?? null)
      : null

  // modal={false} disables Radix's default autofocus, so a keyboard user who
  // triggers a route with Enter has no obvious entry point into the panel.
  // Focus the content explicitly when a route becomes selected; Esc → focus
  // returns to body → next Tab lands on the next interactive element on the
  // page (map is focusable via its own canvas role).
  const contentRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (routeId === null) return
    const el = contentRef.current
    if (el && !el.contains(document.activeElement)) {
      el.focus({ preventScroll: true })
    }
  }, [routeId])

  return (
    <Sheet
      open={routeId !== null}
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        ref={contentRef}
        tabIndex={-1}
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
        aria-describedby="route-detail-description"
        // Close is driven by the Map's background-click handler and by Esc /
        // close button. Auto-closing on outside pointer events would double up
        // with those paths, and also fire on route-to-route swaps.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="gap-2 border-b border-black/10 pb-4 dark:border-white/10">
          {entry && route ? (
            <>
              <div className="flex items-start gap-3">
                <span
                  className="flex h-11 min-w-11 items-center justify-center rounded-md px-2 font-mono text-base font-semibold text-neutral-950 shadow-sm"
                  style={{
                    backgroundColor: badgeColor(
                      entry,
                      route,
                      day,
                      window,
                      thresholds,
                      theme,
                    ),
                  }}
                  aria-label={`Route ${entry.route_short_name}`}
                >
                  {entry.route_short_name}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <SheetTitle className="truncate text-base leading-tight">
                    {entry.route_long_name}
                  </SheetTitle>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {route.agency_name || 'Transit operator'}
                  </p>
                </div>
              </div>
              <SheetDescription id="route-detail-description" className="sr-only">
                Frequency profile and FTN qualification for route{' '}
                {entry.route_short_name}.
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>Route details</SheetTitle>
              <SheetDescription id="route-detail-description">
                Frequency profile and FTN qualification for this route.
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        {route && (
          <div className="flex flex-col gap-5 p-4 text-sm">
            <FtnStatus route={route} thresholds={thresholds} />
            <RouteFrequencyChart route={route} />
            <Termini route={route} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Termini({ route }: { route: RouteFrequency }) {
  const majors = majorPatternsSorted(route)
  const pairs = normalizePatternTermini(majors)
  const minorCount = countMinorPatterns(route)
  if (pairs.length === 0) return null
  return (
    <section
      aria-labelledby="route-detail-termini"
      className="flex flex-col gap-1.5"
    >
      <h3
        id="route-detail-termini"
        className="text-xs font-medium text-neutral-900 dark:text-neutral-100"
      >
        {pairs.length === 1 ? 'Route endpoints' : 'Endpoints'}
      </h3>
      <ul className="flex flex-col gap-1 text-sm text-neutral-800 dark:text-neutral-200">
        {pairs.map(({ a, b }, i) => (
          <li key={`${a}-${b}-${i}`}>
            <span>{a || '—'}</span>
            <span className="mx-2 text-neutral-500" aria-label="to and from">
              ⇄
            </span>
            <span>{b || '—'}</span>
          </li>
        ))}
      </ul>
      {minorCount > 0 && (
        <p className="mt-1 text-[11px] text-neutral-500">
          Also runs: {minorCount} minor pattern{minorCount === 1 ? '' : 's'}.
        </p>
      )}
    </section>
  )
}

function FtnStatus({
  route,
  thresholds,
}: {
  route: RouteFrequency
  thresholds: BandThresholds
}) {
  const qualifies = route.ftn_qualifies
  const band = route.band
  const fallbackBandLabel = bandLabel(band, thresholds)
  return (
    <section aria-labelledby="route-detail-ftn" className="flex flex-col gap-1">
      <h3
        id="route-detail-ftn"
        className="text-xs font-medium text-neutral-900 dark:text-neutral-100"
      >
        Frequent Transit Network
      </h3>
      <p
        className={
          qualifies
            ? 'flex items-center gap-2 text-base font-medium text-emerald-600 dark:text-emerald-400'
            : 'flex items-center gap-2 text-base font-medium text-amber-600 dark:text-amber-400'
        }
      >
        <span aria-hidden="true" className="text-lg leading-none">
          {qualifies ? '✓' : '✗'}
        </span>
        <span>{qualifies ? 'FTN-qualifying' : 'Not FTN-qualifying'}</span>
      </p>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        {qualifies
          ? formatFtnFailure(null)
          : (route.ftn_failure
              ? formatFtnFailure(
                  route.ftn_failure,
                  hourlyChartSeries(route, route.ftn_failure.day_type).find(
                    (p) => p.hour === route.ftn_failure!.hour,
                  )?.headway ?? null,
                )
              : `Classified as ${fallbackBandLabel}.`)}
      </p>
    </section>
  )
}
