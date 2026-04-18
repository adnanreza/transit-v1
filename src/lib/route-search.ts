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
