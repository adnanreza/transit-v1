import { describe, expect, it } from 'vitest'
import { matchRouteQuery, type SearchableRoute } from './route-search'

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
})
