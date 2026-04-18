import type { Band } from '../../scripts/types/frequencies'
import type { BandThresholds } from './route-band'

const BAND_NAMES: Record<Band, string> = {
  very_frequent: 'Very frequent',
  frequent: 'Frequent',
  standard: 'Standard',
  infrequent: 'Infrequent',
  peak_only: 'Peak only',
  night_only: 'Night only',
}

/**
 * Tooltip + panel label for a band: name plus a short description of the
 * frequency range it covers. peak_only / night_only are "when runs" bands —
 * no headway range — so they return just the name.
 */
export function bandLabel(band: Band, thresholds: BandThresholds): string {
  const name = BAND_NAMES[band]
  switch (band) {
    case 'very_frequent':
      return `${name} · ≤${thresholds.very_frequent} min`
    case 'frequent':
      return `${name} · ≤${thresholds.frequent} min`
    case 'standard':
      return `${name} · ≤${thresholds.standard} min`
    case 'infrequent':
      return `${name} · >${thresholds.standard} min`
    case 'peak_only':
    case 'night_only':
      return name
  }
}
