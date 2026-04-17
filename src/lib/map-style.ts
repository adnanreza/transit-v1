import { layers, namedTheme } from 'protomaps-themes-base'
import type { StyleSpecification } from 'maplibre-gl'

// Protomaps' public demo tileset. Fine for dev — browsers only fetch the byte
// ranges they need — but production should self-host a PMTiles extract on R2
// with a custom domain. That swap is a deploy-feature concern; here we just
// make the URL configurable via the env var.
const DEFAULT_PMTILES_URL = 'https://demo-bucket.protomaps.com/v4.pmtiles'

export function getPmtilesUrl(): string {
  return import.meta.env.VITE_PMTILES_URL || DEFAULT_PMTILES_URL
}

// Dark basemap style with all Protomaps default layers. Label fonts are
// loaded from Protomaps' public glyph endpoint; they can be self-hosted later.
export function buildMapStyle(pmtilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedTheme('dark')),
  }
}
