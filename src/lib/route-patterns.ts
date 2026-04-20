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

export interface TerminusPair {
  a: string
  b: string
}

/**
 * Collapse reverse-direction major patterns into a single A ⇄ B pair so the
 * termini list doesn't show the same two stops twice with swapped order.
 *
 * Rules:
 * - Patterns whose (first, last) stop names are an exact swap of another
 *   pattern's pair are treated as the same "line" and merged.
 * - The preserved ordering uses the first-seen (a, b) from the incoming list,
 *   so the display stays stable across renders.
 * - Non-matching patterns (true branches — different endpoints) are kept as
 *   separate entries.
 */
export function normalizePatternTermini(
  patterns: PatternFrequency[],
): TerminusPair[] {
  const seen = new Set<string>()
  const out: TerminusPair[] = []
  for (const p of patterns) {
    const a = p.first_stop_name
    const b = p.last_stop_name
    if (!a && !b) continue
    // Canonical key is the sorted pair so that A→B and B→A collapse.
    const key = [a, b].sort().join('\x00')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ a, b })
  }
  return out
}
