import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMapStyle, getPmtilesUrl } from './map-style'

describe('getPmtilesUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to the same-origin Metro Vancouver extract', () => {
    vi.stubEnv('VITE_PMTILES_URL', '')
    expect(getPmtilesUrl()).toBe('/data/basemap.pmtiles')
  })

  it('honors a VITE_PMTILES_URL override for prod (R2) deploys', () => {
    vi.stubEnv('VITE_PMTILES_URL', 'https://tiles.example.com/metrovan.pmtiles')
    expect(getPmtilesUrl()).toBe('https://tiles.example.com/metrovan.pmtiles')
  })
})

describe('buildMapStyle', () => {
  it('prefixes the PMTiles URL with the pmtiles:// protocol so the MapLibre handler picks it up', () => {
    const style = buildMapStyle('/data/basemap.pmtiles')
    const source = style.sources.protomaps as { type: string; url?: string }
    expect(source.type).toBe('vector')
    expect(source.url).toBe('pmtiles:///data/basemap.pmtiles')
  })

  it('emits a style spec version 8 with at least one layer from the Protomaps theme', () => {
    const style = buildMapStyle('/data/basemap.pmtiles')
    expect(style.version).toBe(8)
    expect(style.layers.length).toBeGreaterThan(0)
  })
})
