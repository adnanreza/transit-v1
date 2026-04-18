import { describe, expect, it } from 'vitest'
import {
  matchesModeFilter,
  modeFilterExpression,
  MODES,
  type Mode,
} from './modes'

const setOf = (...modes: Mode[]) => new Set<Mode>(modes)

describe('matchesModeFilter', () => {
  it('matches buses when bus mode is enabled', () => {
    expect(matchesModeFilter('3', setOf('bus'))).toBe(true)
  })

  it('rejects buses when bus mode is disabled', () => {
    expect(matchesModeFilter('3', setOf('skytrain', 'seabus', 'wce'))).toBe(false)
  })

  it('matches SkyTrain (route_type 1) only when skytrain is enabled', () => {
    expect(matchesModeFilter('1', setOf('skytrain'))).toBe(true)
    expect(matchesModeFilter('1', setOf('bus'))).toBe(false)
  })

  it('matches WCE (route_type 2) only when wce is enabled', () => {
    expect(matchesModeFilter('2', setOf('wce'))).toBe(true)
    expect(matchesModeFilter('2', setOf('bus', 'skytrain', 'seabus'))).toBe(false)
  })

  it('matches SeaBus (route_type 4) only when seabus is enabled', () => {
    expect(matchesModeFilter('4', setOf('seabus'))).toBe(true)
    expect(matchesModeFilter('4', setOf('bus', 'skytrain', 'wce'))).toBe(false)
  })

  it('rejects everything when no modes are enabled', () => {
    const empty = new Set<Mode>()
    for (const routeType of ['1', '2', '3', '4']) {
      expect(matchesModeFilter(routeType, empty)).toBe(false)
    }
  })

  it('accepts every defined route_type when every mode is enabled', () => {
    const all = new Set<Mode>(MODES)
    for (const routeType of ['1', '2', '3', '4']) {
      expect(matchesModeFilter(routeType, all)).toBe(true)
    }
  })
})

describe('modeFilterExpression', () => {
  it('builds an `in` filter on route_type with the enabled modes\' GTFS codes', () => {
    const expr = modeFilterExpression(setOf('bus', 'skytrain')) as unknown as [
      string,
      unknown,
      unknown,
    ]
    expect(expr[0]).toBe('in')
    expect(expr[1]).toEqual(['get', 'route_type'])
    // 3rd element is ['literal', [...types]]; bus=3, skytrain=1
    expect(expr[2]).toEqual(['literal', ['3', '1']])
  })

  it('returns an empty literal when no modes are enabled so nothing matches', () => {
    const expr = modeFilterExpression(new Set<Mode>()) as unknown as [
      string,
      unknown,
      unknown,
    ]
    expect(expr[2]).toEqual(['literal', []])
  })

  it('emits every GTFS code exactly once when every mode is enabled', () => {
    const expr = modeFilterExpression(new Set<Mode>(MODES)) as unknown as [
      string,
      unknown,
      ['literal', string[]],
    ]
    expect(new Set(expr[2][1])).toEqual(new Set(['1', '2', '3', '4']))
  })
})
