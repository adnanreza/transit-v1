import { describe, expect, it } from 'vitest'
import {
  displayShortName,
  matchRouteQuery,
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
