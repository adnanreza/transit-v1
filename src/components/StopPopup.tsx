import { useEffect } from 'react'
import { displayShortName } from '@/lib/route-search'
import type { RouteIndexEntry } from '@/lib/use-routes'
import type { UseStopRoutesState } from '@/lib/stop-routes'

interface StopPopupProps {
  x: number
  y: number
  stopName: string
  stopCode: string
  stopId: string
  stopRoutesState: UseStopRoutesState
  routes: RouteIndexEntry[] | null
  onRouteSelect: (routeId: string) => void
  onClose: () => void
}

const FALLBACK_BADGE_BG = '#525252'

// GTFS route_type '3' = bus; everything else (SkyTrain, SeaBus, WCE) keeps
// its brand color via route_color so the SeaBus badge reads as SeaBus etc.
function badgeColor(route: RouteIndexEntry): string {
  if (route.route_type !== '3' && route.route_color) {
    return `#${route.route_color}`
  }
  return FALLBACK_BADGE_BG
}

/**
 * Anchored above the clicked stop, with a CSS triangle pointing down at
 * the dot. Positioned via transform so the browser can composite it
 * cheaply while the map animates. The caller owns the (x, y) pixel
 * coordinates and re-projects them on map move events; when the stop
 * scrolls off-screen the caller calls onClose.
 */
export function StopPopup({
  x,
  y,
  stopName,
  stopCode,
  stopId,
  stopRoutesState,
  routes,
  onRouteSelect,
  onClose,
}: StopPopupProps) {
  const routeIds = stopRoutesState.data?.[stopId] ?? null
  const routesById = routes
    ? new Map(routes.map((r) => [r.route_id, r]))
    : null

  // Escape closes the popup — standard for a dismissible dialog and keeps
  // keyboard-only users from being stuck if the × button isn't focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="pointer-events-auto absolute z-40 w-64 -translate-x-1/2 -translate-y-full"
      style={{ left: x, top: y - 12 }}
      role="dialog"
      aria-label={`Stop ${stopName}`}
    >
      <div className="relative rounded-md bg-white/95 p-3 text-xs text-neutral-900 shadow-xl ring-1 ring-black/10 backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-100 dark:ring-white/10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stop details"
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          ×
        </button>
        <div className="pr-5">
          <h3 className="text-sm font-medium leading-tight">{stopName}</h3>
          {stopCode ? (
            <p className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
              Stop #{stopCode}
            </p>
          ) : null}
        </div>
        <div className="mt-2">
          <h4 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
            Routes serving this stop
          </h4>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <RouteBadges
              routeIds={routeIds}
              routesById={routesById}
              state={stopRoutesState.status}
              onSelect={onRouteSelect}
            />
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute left-1/2 size-3 -translate-x-1/2 rotate-45 bg-white/95 ring-1 ring-black/10 dark:bg-neutral-950/95 dark:ring-white/10"
        style={{ top: 'calc(100% - 6px)' }}
      />
    </div>
  )
}

function RouteBadges({
  routeIds,
  routesById,
  state,
  onSelect,
}: {
  routeIds: string[] | null
  routesById: Map<string, RouteIndexEntry> | null
  state: UseStopRoutesState['status']
  onSelect: (routeId: string) => void
}) {
  if (state === 'loading' || state === 'idle') {
    return (
      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
        Loading…
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="text-[11px] text-amber-600 dark:text-amber-400">
        Couldn't load route list.
      </span>
    )
  }
  if (!routeIds || routeIds.length === 0) {
    return (
      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
        No fixed-route service.
      </span>
    )
  }
  return (
    <>
      {routeIds.map((id) => {
        const route = routesById?.get(id)
        const short = route
          ? displayShortName(route.route_short_name) || '—'
          : id
        const bg = route ? badgeColor(route) : FALLBACK_BADGE_BG
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="flex h-7 min-w-9 items-center justify-center rounded px-1.5 font-mono text-xs font-bold text-neutral-950 shadow-sm transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:outline-none dark:focus-visible:ring-neutral-100"
            style={{ backgroundColor: bg }}
            aria-label={
              route ? `Open route ${short} detail` : `Open route ${id} detail`
            }
          >
            {short}
          </button>
        )
      })}
    </>
  )
}
