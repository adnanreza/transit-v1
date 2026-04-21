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

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '')
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
