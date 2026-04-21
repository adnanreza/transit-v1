/**
 * Tiny, pure predicate for matching a user query against a single route.
 *
 * Queries are normalized: lowercased, trimmed, whitespace and hyphens
 * collapsed out so "b-line", "bline", and "B LINE" all hit the same target.
 * Returns true if the normalized query is a prefix of either the route's
 * short name (`99`, `R5`, `N10`) or long name (`Commercial-Broadway/UBC`,
 * `Hastings`, etc.), after the same normalization.
 */
export interface SearchableRoute {
  route_id: string
  route_short_name: string
  route_long_name: string
}

// Strip GTFS-style leading-zero padding from all-digit tokens so "99" and
// "099" collapse to the same search key. Non-digit tokens (r5, ubc, n10)
// are untouched — leading zeros only have this cosmetic role in the
// all-numeric route-number space.
function stripNumericPad(token: string): string {
  if (!/^\d+$/.test(token)) return token
  const trimmed = token.replace(/^0+/, '')
  return trimmed.length === 0 ? '0' : trimmed
}

function normalize(value: string): string {
  const collapsed = value.toLowerCase().replace(/[\s-]+/g, '')
  return stripNumericPad(collapsed)
}

export function matchRouteQuery(
  query: string,
  route: SearchableRoute,
): boolean {
  const q = normalize(query)
  if (q.length === 0) return true
  const short = normalize(route.route_short_name)
  const long = normalize(route.route_long_name)
  return short.includes(q) || long.includes(q)
}

/**
 * Strip GTFS leading-zero padding from all-numeric short names so riders
 * see the number on the bus: "099" → "99", "004" → "4". Non-numeric short
 * names (R4, N10, C23) pass through unchanged. A literal "0" stays "0".
 *
 * This is a display transform only — route_id, GeoJSON properties, and
 * search matching keep the raw padded form.
 */
export function displayShortName(short: string): string {
  if (short.length === 0) return short
  if (!/^\d+$/.test(short)) return short
  const trimmed = short.replace(/^0+/, '')
  return trimmed.length === 0 ? '0' : trimmed
}

export interface CategorizableRoute {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_type: string
}

export interface EmptyStateGroups<T extends CategorizableRoute> {
  rapidTransit: T[]
  rapidBus: T[]
  frequent: T[]
  other: T[]
}

// Rapid transit ordering — matches TransLink's own way of introducing the
// modes (oldest SkyTrain line first, then newer ones, then SeaBus, then
// WCE). Routes not on this list fall to the end of the group in input order.
const RAPID_TRANSIT_ORDER: ReadonlyArray<RegExp> = [
  /^expo line$/i,
  /^millennium line$/i,
  /^canada line$/i,
  /^seabus$/i,
  /west coast express|^wce$/i,
]

function rapidTransitSortKey(route: CategorizableRoute): number {
  const name = route.route_long_name
  for (let i = 0; i < RAPID_TRANSIT_ORDER.length; i++) {
    if (RAPID_TRANSIT_ORDER[i].test(name)) return i
  }
  return RAPID_TRANSIT_ORDER.length
}

export function isRapidTransit(route: CategorizableRoute): boolean {
  return route.route_type !== '3'
}

// RapidBus short names are one letter (R) followed by one or more digits.
// N-prefix (N10 etc.) is NightBus — a different band, not a RapidBus line.
export function isRapidBus(route: CategorizableRoute): boolean {
  if (route.route_type !== '3') return false
  return /^R\d+$/.test(route.route_short_name)
}

/**
 * Group the route index into the four lists the search dropdown renders
 * when the query is blank. A route can land in exactly one group: rapid
 * transit, RapidBus, frequent bus (given a band lookup), or everything
 * else. The `frequent` band lookup is keyed by route_id — at least the
 * `frequent` / `very_frequent` weekday-midday routes belong there; pass
 * `null` for the lookup to skip that group entirely (it's optional so
 * the search can render before frequencies.json has loaded).
 */
export function groupRoutesForEmptyState<T extends CategorizableRoute>(
  routes: readonly T[],
  isFrequent: ((route: T) => boolean) | null,
): EmptyStateGroups<T> {
  const rapidTransit: T[] = []
  const rapidBus: T[] = []
  const frequent: T[] = []
  const other: T[] = []
  for (const route of routes) {
    if (isRapidTransit(route)) {
      rapidTransit.push(route)
      continue
    }
    if (isRapidBus(route)) {
      rapidBus.push(route)
      continue
    }
    if (isFrequent && isFrequent(route)) {
      frequent.push(route)
      continue
    }
    other.push(route)
  }
  rapidTransit.sort((a, b) => rapidTransitSortKey(a) - rapidTransitSortKey(b))
  return { rapidTransit, rapidBus, frequent, other }
}

function rankTier(query: string, route: CategorizableRoute): number {
  const q = normalize(query)
  const short = normalize(route.route_short_name)
  const long = normalize(route.route_long_name)
  if (short === q) return 0
  if (short.startsWith(q)) return 1
  if (short.includes(q)) return 2
  if (long.startsWith(q)) return 3
  if (long.includes(q)) return 4
  return 5
}

/**
 * Rank matched routes by how closely the query matches the short name vs.
 * the long name: exact short-name hits lead, then short-name prefix, then
 * short-name substring, then long-name prefix, then long-name substring.
 * Falls back to the input order (which is already numeric-then-alpha from
 * buildIndex) within each tier.
 */
export function rankedMatches<T extends CategorizableRoute>(
  query: string,
  routes: readonly T[],
): T[] {
  const q = query.trim()
  if (q.length === 0) return routes.slice()
  const scored: { route: T; tier: number; i: number }[] = []
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i]
    if (!matchRouteQuery(q, route)) continue
    scored.push({ route, tier: rankTier(q, route), i })
  }
  scored.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.i - b.i))
  return scored.map((s) => s.route)
}

export interface HighlightSpan {
  before: string
  match: string
  after: string
}

/**
 * Find the matched substring of `query` in `text` for inline `<mark>`
 * highlighting. Works on the raw text (not normalized), so queries with
 * hyphens / spaces that only match after collapsing (e.g. "b-line"
 * vs. "B-Line") won't highlight — that's OK; the caller can render the
 * whole row as fallback. Returns null if no direct case-insensitive
 * substring match.
 */
export function highlightMatch(
  text: string,
  query: string,
): HighlightSpan | null {
  const q = query.trim()
  if (q.length === 0) return null
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return null
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + q.length),
    after: text.slice(idx + q.length),
  }
}
