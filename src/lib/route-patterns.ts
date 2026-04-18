import type {
  PatternFrequency,
  RouteFrequency,
} from '../../scripts/types/frequencies'
import { MAJOR_PATTERN_TRIP_SHARE } from './route-band'

/**
 * Major patterns (trip_share ≥ 0.2) sorted by trip_share descending. Ties
 * break in the original order to keep the list stable across renders — the
 * panel's pattern list shouldn't reshuffle on prop changes that don't move
 * any shares.
 */
export function majorPatternsSorted(route: RouteFrequency): PatternFrequency[] {
  return route.patterns
    .filter((p) => p.trip_share >= MAJOR_PATTERN_TRIP_SHARE)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (b.p.trip_share !== a.p.trip_share) {
        return b.p.trip_share - a.p.trip_share
      }
      return a.i - b.i
    })
    .map(({ p }) => p)
}

/**
 * Count of minor patterns (trip_share < 0.2) — used for the footnote.
 */
export function countMinorPatterns(route: RouteFrequency): number {
  let n = 0
  for (const p of route.patterns) {
    if (p.trip_share < MAJOR_PATTERN_TRIP_SHARE) n++
  }
  return n
}
