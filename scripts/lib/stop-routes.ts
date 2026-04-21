import type { PatternSummary } from './patterns.ts'

export type StopRoutesIndex = Record<string, string[]>

interface RouteWithShortName {
  route_id: string
  route_short_name: string
}

// Stable sort for route_ids by short_name — numeric-first, then alphabetic.
// Mirrors the `buildIndex` ordering in src/lib/use-routes.ts so the popup
// UI presents routes in the same order users see in search.
function sortRouteIds(
  ids: Iterable<string>,
  shortNameById: Map<string, string>,
): string[] {
  const arr = [...ids]
  arr.sort((a, b) => {
    const sa = shortNameById.get(a) ?? ''
    const sb = shortNameById.get(b) ?? ''
    const na = Number(sa)
    const nb = Number(sb)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    if (Number.isFinite(na)) return -1
    if (Number.isFinite(nb)) return 1
    if (sa && sb) return sa.localeCompare(sb)
    return a.localeCompare(b)
  })
  return arr
}

/**
 * Reverse index from stop_id to every route_id whose patterns touch that
 * stop. Consumed by the map's stop-click popup to answer "what routes
 * serve this stop?" without loading stop_times.txt into the browser.
 *
 * A route can reach a stop through any of its trip patterns; a stop seen
 * on multiple patterns of the same route is counted once.
 */
export function buildStopRoutesIndex(
  patterns: Iterable<PatternSummary>,
  routes: readonly RouteWithShortName[],
): StopRoutesIndex {
  const shortNameById = new Map(
    routes.map((r) => [r.route_id, r.route_short_name]),
  )
  const byStop = new Map<string, Set<string>>()
  for (const pattern of patterns) {
    const routeId = pattern.route_id
    for (const stopId of pattern.stop_ids) {
      let set = byStop.get(stopId)
      if (!set) {
        set = new Set<string>()
        byStop.set(stopId, set)
      }
      set.add(routeId)
    }
  }
  const out: StopRoutesIndex = {}
  const stopIds = [...byStop.keys()].sort()
  for (const stopId of stopIds) {
    out[stopId] = sortRouteIds(byStop.get(stopId)!, shortNameById)
  }
  return out
}
