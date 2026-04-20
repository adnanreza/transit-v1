import { describe, expect, it } from 'vitest'
import { isTransitLayerOrderValid } from './layer-stack'

const STACK = [
  'stops-circles',
  'routes-lines-rapid-casing',
  'routes-lines-dashed',
  'routes-lines-solid',
  'routes-lines-selected',
] as const

describe('isTransitLayerOrderValid', () => {
  it('returns true when every required id appears in the expected order', () => {
    const style = [
      'base-land',
      'base-water',
      'stops-circles',
      'routes-lines-rapid-casing',
      'routes-lines-dashed',
      'routes-lines-solid',
      'routes-lines-selected',
    ]
    expect(isTransitLayerOrderValid(style, STACK)).toBe(true)
  })

  it('tolerates unrelated layers interleaved between the required ones', () => {
    // PMTiles basemap layers that happen to land between ours shouldn't fail
    // the check — the contract is on relative order, not adjacency.
    const style = [
      'stops-circles',
      'base-labels',
      'routes-lines-rapid-casing',
      'base-water-labels',
      'routes-lines-dashed',
      'base-pois',
      'routes-lines-solid',
      'routes-lines-selected',
    ]
    expect(isTransitLayerOrderValid(style, STACK)).toBe(true)
  })

  it('returns false when one required id is missing from the style', () => {
    const style = [
      'stops-circles',
      'routes-lines-solid',
      'routes-lines-selected',
    ]
    expect(isTransitLayerOrderValid(style, STACK)).toBe(false)
  })

  it('returns false when the casing lands above a route layer', () => {
    const style = [
      'stops-circles',
      'routes-lines-dashed',
      'routes-lines-rapid-casing',
      'routes-lines-solid',
      'routes-lines-selected',
    ]
    expect(isTransitLayerOrderValid(style, STACK)).toBe(false)
  })

  it('returns false when the stops layer ends up above a route layer', () => {
    const style = [
      'routes-lines-rapid-casing',
      'routes-lines-dashed',
      'stops-circles',
      'routes-lines-solid',
      'routes-lines-selected',
    ]
    expect(isTransitLayerOrderValid(style, STACK)).toBe(false)
  })

  it('returns false when the selected overlay lands below the route it overlays', () => {
    const style = [
      'stops-circles',
      'routes-lines-rapid-casing',
      'routes-lines-selected',
      'routes-lines-dashed',
      'routes-lines-solid',
    ]
    expect(isTransitLayerOrderValid(style, STACK)).toBe(false)
  })

  it('returns true trivially for an empty required stack', () => {
    expect(isTransitLayerOrderValid(['anything'], [])).toBe(true)
  })
})
