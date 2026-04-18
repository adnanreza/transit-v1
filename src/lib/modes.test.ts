import { describe, expect, it } from 'vitest'
import { matchesModeFilter, MODES, type Mode } from './modes'

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
