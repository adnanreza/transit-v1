import { describe, expect, it } from 'vitest'
import {
  displayShortName,
  groupRoutesForEmptyState,
  highlightMatch,
  isRapidBus,
  isRapidTransit,
  matchRouteQuery,
  rankedMatches,
  type CategorizableRoute,
  type SearchableRoute,
} from './route-search'

function route(
  route_id: string,
  route_short_name: string,
  route_long_name: string,
): SearchableRoute {
  return { route_id, route_short_name, route_long_name }
}

describe('matchRouteQuery', () => {
  it('matches the short name as a prefix', () => {
    expect(matchRouteQuery('99', route('1', '99', 'Commercial-Broadway'))).toBe(true)
  })

  it('matches the short name exactly', () => {
    expect(matchRouteQuery('R5', route('2', 'R5', 'Hastings St'))).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matchRouteQuery('R5', route('2', 'r5', 'Hastings St'))).toBe(true)
    expect(matchRouteQuery('r5', route('2', 'R5', 'Hastings St'))).toBe(true)
  })

  it("matches b-line style with or without a hyphen", () => {
    const bline = route('3', '99', 'UBC B-Line')
    expect(matchRouteQuery('bline', bline)).toBe(true)
    expect(matchRouteQuery('b-line', bline)).toBe(true)
    expect(matchRouteQuery('B LINE', bline)).toBe(true)
  })

  it('matches against the long name too', () => {
    expect(matchRouteQuery('hastings', route('4', '14', 'Hastings/UBC'))).toBe(true)
    expect(matchRouteQuery('UBC', route('4', '14', 'Hastings/UBC'))).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(matchRouteQuery('kerrisdale', route('5', '33', '29th Ave Station/UBC'))).toBe(false)
  })

  it('treats an empty or whitespace query as a match-all', () => {
    const r = route('6', '99', 'Commercial-Broadway')
    expect(matchRouteQuery('', r)).toBe(true)
    expect(matchRouteQuery('   ', r)).toBe(true)
  })

  it('matches a GTFS zero-padded short name from either side', () => {
    const r99padded = route('7', '099', 'Commercial-Broadway/UBC (B-Line)')
    expect(matchRouteQuery('99', r99padded)).toBe(true)
    expect(matchRouteQuery('099', r99padded)).toBe(true)
    const r4padded = route('8', '004', 'Powell/Downtown/UBC')
    expect(matchRouteQuery('4', r4padded)).toBe(true)
    expect(matchRouteQuery('04', r4padded)).toBe(true)
    expect(matchRouteQuery('004', r4padded)).toBe(true)
  })

  it('does not strip zeros from alphanumeric tokens', () => {
    const n10 = route('9', 'N10', 'Night Bus')
    expect(matchRouteQuery('N10', n10)).toBe(true)
    // "N01" should not silently match N10 (the zero sits inside an
    // alphanumeric token, not an all-digit one).
    expect(matchRouteQuery('N01', n10)).toBe(false)
  })
})

function cat(
  route_id: string,
  route_short_name: string,
  route_long_name: string,
  route_type: string,
): CategorizableRoute {
  return { route_id, route_short_name, route_long_name, route_type }
}

describe('isRapidTransit / isRapidBus', () => {
  it('classifies rapid transit by non-bus route_type', () => {
    expect(isRapidTransit(cat('expo', '', 'Expo Line', '1'))).toBe(true)
    expect(isRapidTransit(cat('seabus', '', 'SeaBus', '4'))).toBe(true)
    expect(isRapidTransit(cat('99', '099', 'UBC', '3'))).toBe(false)
  })

  it('classifies RapidBus by R<digits> short name + bus route_type', () => {
    expect(isRapidBus(cat('r4', 'R4', '41st Ave', '3'))).toBe(true)
    expect(isRapidBus(cat('n10', 'N10', 'NightBus', '3'))).toBe(false)
    expect(isRapidBus(cat('099', '099', 'UBC', '3'))).toBe(false)
    // Route_type gate — a rail line with short_name "R1" would not count.
    expect(isRapidBus(cat('fake', 'R1', 'Rail 1', '1'))).toBe(false)
  })
})

describe('groupRoutesForEmptyState', () => {
  const routes: CategorizableRoute[] = [
    cat('099', '099', 'Commercial-Broadway/UBC (B-Line)', '3'),
    cat('canada', '', 'Canada Line', '1'),
    cat('expo', '', 'Expo Line', '1'),
    cat('millennium', '', 'Millennium Line', '1'),
    cat('r4', 'R4', '41st Ave', '3'),
    cat('r1', 'R1', 'King George', '3'),
    cat('seabus', '', 'SeaBus', '4'),
    cat('014', '014', 'Hastings/UBC', '3'),
    cat('340', '340', 'Scottsdale/Newton', '3'),
    cat('wce', 'WCE', 'West Coast Express', '2'),
  ]

  it('orders rapid transit in the curated sequence (Expo → Millennium → Canada → SeaBus → WCE)', () => {
    const { rapidTransit } = groupRoutesForEmptyState(routes, null)
    expect(rapidTransit.map((r) => r.route_id)).toEqual([
      'expo',
      'millennium',
      'canada',
      'seabus',
      'wce',
    ])
  })

  it('collects RapidBus routes under their own group', () => {
    const { rapidBus } = groupRoutesForEmptyState(routes, null)
    expect(rapidBus.map((r) => r.route_id).sort()).toEqual(['r1', 'r4'])
  })

  it('places remaining routes in `other` when no frequent predicate is provided', () => {
    const { frequent, other } = groupRoutesForEmptyState(routes, null)
    expect(frequent).toEqual([])
    expect(other.map((r) => r.route_id)).toEqual(['099', '014', '340'])
  })

  it('splits buses into frequent vs other when a predicate is provided', () => {
    const isFrequent = (r: CategorizableRoute) =>
      r.route_id === '099' || r.route_id === '014'
    const { frequent, other } = groupRoutesForEmptyState(routes, isFrequent)
    expect(frequent.map((r) => r.route_id)).toEqual(['099', '014'])
    expect(other.map((r) => r.route_id)).toEqual(['340'])
  })
})

describe('rankedMatches', () => {
  const routes: CategorizableRoute[] = [
    cat('099', '099', 'Commercial-Broadway/UBC (B-Line)', '3'),
    cat('014', '014', 'Hastings/UBC', '3'),
    cat('340', '340', 'Scottsdale/Newton', '3'),
    cat('341', '341', 'Guildford', '3'),
    cat('r4', 'R4', '41st Ave / UBC', '3'),
    cat('canada', '', 'Canada Line', '1'),
  ]

  it('returns the full list when query is blank', () => {
    expect(rankedMatches('', routes).length).toBe(routes.length)
  })

  it('ranks short-name exact match above prefix above substring', () => {
    const result = rankedMatches('34', routes)
    // Both 340 and 341 are prefix-tier; either order is acceptable,
    // but neither should be preceded by a long-name match.
    expect(result.slice(0, 2).map((r) => r.route_id).sort()).toEqual([
      '340',
      '341',
    ])
  })

  it('places 99 first when the query is exactly "99"', () => {
    const result = rankedMatches('99', routes)
    expect(result[0].route_id).toBe('099')
  })

  it('puts long-name matches after short-name matches', () => {
    const result = rankedMatches('ubc', routes)
    // "ubc" is only a long-name match — all three should appear, and
    // ordering within that tier falls to input order.
    expect(result.map((r) => r.route_id)).toEqual(['099', '014', 'r4'])
  })
})

describe('highlightMatch', () => {
  it('returns the span when a case-insensitive substring matches', () => {
    expect(highlightMatch('Commercial-Broadway/UBC', 'broadway')).toEqual({
      before: 'Commercial-',
      match: 'Broadway',
      after: '/UBC',
    })
  })

  it('returns null when the substring does not appear', () => {
    expect(highlightMatch('Expo Line', 'bline')).toBeNull()
  })

  it('returns null for empty queries', () => {
    expect(highlightMatch('Expo Line', '   ')).toBeNull()
  })
})

describe('displayShortName', () => {
  it('strips leading zeros from all-numeric GTFS short names', () => {
    expect(displayShortName('099')).toBe('99')
    expect(displayShortName('004')).toBe('4')
    expect(displayShortName('016')).toBe('16')
    expect(displayShortName('123')).toBe('123')
  })

  it('leaves non-numeric short names unchanged', () => {
    expect(displayShortName('R4')).toBe('R4')
    expect(displayShortName('N10')).toBe('N10')
    expect(displayShortName('C23')).toBe('C23')
  })

  it('preserves a literal zero and handles the empty string', () => {
    expect(displayShortName('0')).toBe('0')
    expect(displayShortName('00')).toBe('0')
    expect(displayShortName('')).toBe('')
  })
})
