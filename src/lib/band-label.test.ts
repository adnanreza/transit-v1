import { describe, expect, it } from 'vitest'
import { bandLabel } from './band-label'
import { DEFAULT_THRESHOLDS, type BandThresholds } from './route-band'

describe('bandLabel', () => {
  it('renders each frequency band with its threshold from the active config', () => {
    expect(bandLabel('very_frequent', DEFAULT_THRESHOLDS)).toBe(
      'Very frequent · ≤10 min',
    )
    expect(bandLabel('frequent', DEFAULT_THRESHOLDS)).toBe('Frequent · ≤15 min')
    expect(bandLabel('standard', DEFAULT_THRESHOLDS)).toBe('Standard · ≤30 min')
    expect(bandLabel('infrequent', DEFAULT_THRESHOLDS)).toBe(
      'Infrequent · >30 min',
    )
  })

  it('reflects user-customized thresholds', () => {
    const custom: BandThresholds = {
      very_frequent: 8,
      frequent: 12,
      standard: 25,
    }
    expect(bandLabel('very_frequent', custom)).toBe('Very frequent · ≤8 min')
    expect(bandLabel('frequent', custom)).toBe('Frequent · ≤12 min')
    expect(bandLabel('standard', custom)).toBe('Standard · ≤25 min')
    expect(bandLabel('infrequent', custom)).toBe('Infrequent · >25 min')
  })

  it('omits headway ranges for the when-it-runs bands (peak / night)', () => {
    expect(bandLabel('peak_only', DEFAULT_THRESHOLDS)).toBe('Peak only')
    expect(bandLabel('night_only', DEFAULT_THRESHOLDS)).toBe('Night only')
  })
})
