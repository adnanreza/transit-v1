import { describe, expect, it } from 'vitest'
import {
  centerParser,
  dayTypeParser,
  modeListParser,
  resolveTheme,
  themeParser,
  thresholdsParser,
  timeWindowParser,
  viewsDiffer,
  type MapView,
} from './url-state'
import { DEFAULT_THRESHOLDS } from './route-band'

describe('dayTypeParser', () => {
  it('accepts every canonical value', () => {
    expect(dayTypeParser.parse('weekday')).toBe('weekday')
    expect(dayTypeParser.parse('saturday')).toBe('saturday')
    expect(dayTypeParser.parse('sunday')).toBe('sunday')
  })

  it('rejects anything else with null', () => {
    expect(dayTypeParser.parse('monday')).toBeNull()
    expect(dayTypeParser.parse('Weekday')).toBeNull()
    expect(dayTypeParser.parse('')).toBeNull()
  })
})

describe('timeWindowParser', () => {
  it('accepts every canonical value', () => {
    for (const w of [
      'all_day',
      'am_peak',
      'midday',
      'pm_peak',
      'evening',
      'late_night',
    ]) {
      expect(timeWindowParser.parse(w)).toBe(w)
    }
  })

  it('rejects unknown values', () => {
    expect(timeWindowParser.parse('rush')).toBeNull()
    expect(timeWindowParser.parse('AM_PEAK')).toBeNull()
  })
})

describe('modeListParser', () => {
  it('parses a comma-joined list of valid modes', () => {
    expect(modeListParser.parse('bus,skytrain')).toEqual(['bus', 'skytrain'])
  })

  it('drops unknown tokens but keeps known ones', () => {
    expect(modeListParser.parse('bus,hovercraft,wce')).toEqual(['bus', 'wce'])
  })

  it('round-trips known modes through serialize', () => {
    const input = ['bus', 'seabus'] as const
    expect(modeListParser.parse(modeListParser.serialize([...input]))).toEqual([...input])
  })

  it('returns null for an all-invalid list so the hook falls back to the default', () => {
    expect(modeListParser.parse('ferry,hovercraft')).toBeNull()
  })
})

describe('thresholdsParser', () => {
  it('round-trips SPEC defaults', () => {
    const s = thresholdsParser.serialize(DEFAULT_THRESHOLDS)
    expect(s).toBe('10,15,30')
    expect(thresholdsParser.parse(s)).toEqual(DEFAULT_THRESHOLDS)
  })

  it('accepts any monotonic triple inside [1, 60]', () => {
    expect(thresholdsParser.parse('5,10,20')).toEqual({
      very_frequent: 5,
      frequent: 10,
      standard: 20,
    })
    expect(thresholdsParser.parse('1,2,60')).toEqual({
      very_frequent: 1,
      frequent: 2,
      standard: 60,
    })
  })

  it('rejects wrong arity', () => {
    expect(thresholdsParser.parse('10,15')).toBeNull()
    expect(thresholdsParser.parse('10,15,30,45')).toBeNull()
  })

  it('rejects NaN and non-numeric tokens', () => {
    expect(thresholdsParser.parse('10,abc,30')).toBeNull()
    expect(thresholdsParser.parse(',,')).toBeNull()
  })

  it('rejects values outside [1, 60]', () => {
    expect(thresholdsParser.parse('0,15,30')).toBeNull()
    expect(thresholdsParser.parse('10,15,61')).toBeNull()
    expect(thresholdsParser.parse('-5,10,20')).toBeNull()
  })

  it('rejects non-monotonic triples', () => {
    expect(thresholdsParser.parse('15,10,30')).toBeNull()
    expect(thresholdsParser.parse('10,30,15')).toBeNull()
    expect(thresholdsParser.parse('10,10,30')).toBeNull()
  })
})

describe('viewsDiffer', () => {
  const base: MapView = { center: [-123.05, 49.25], zoom: 10 }

  it('returns false for identical views', () => {
    expect(viewsDiffer(base, { ...base })).toBe(false)
  })

  it('returns false for drift inside every threshold (the self-round-trip case)', () => {
    const jittered: MapView = {
      center: [-123.05 + 0.00005, 49.25 - 0.00005],
      zoom: 10.005,
    }
    expect(viewsDiffer(base, jittered)).toBe(false)
  })

  it('fires when longitude drifts past the threshold', () => {
    expect(viewsDiffer(base, { ...base, center: [-123.051, 49.25] })).toBe(true)
  })

  it('fires when latitude drifts past the threshold', () => {
    expect(viewsDiffer(base, { ...base, center: [-123.05, 49.251] })).toBe(true)
  })

  it('fires when zoom drifts past the threshold', () => {
    expect(viewsDiffer(base, { ...base, zoom: 10.5 })).toBe(true)
  })
})

describe('centerParser', () => {
  it('round-trips a valid lon,lat pair at 4-decimal precision', () => {
    expect(centerParser.parse('-123.05,49.25')).toEqual([-123.05, 49.25])
    expect(centerParser.serialize([-123.10009, 49.28])).toBe('-123.1001,49.28')
  })

  it('rejects out-of-bounds coordinates', () => {
    expect(centerParser.parse('-200,49')).toBeNull()
    expect(centerParser.parse('-123,91')).toBeNull()
  })

  it('rejects wrong arity or NaN tokens', () => {
    expect(centerParser.parse('-123.05')).toBeNull()
    expect(centerParser.parse('-123,abc')).toBeNull()
  })
})

describe('themeParser', () => {
  it('accepts the three canonical values', () => {
    expect(themeParser.parse('system')).toBe('system')
    expect(themeParser.parse('light')).toBe('light')
    expect(themeParser.parse('dark')).toBe('dark')
  })

  it('rejects anything else with null', () => {
    expect(themeParser.parse('auto')).toBeNull()
    expect(themeParser.parse('Dark')).toBeNull()
    expect(themeParser.parse('')).toBeNull()
  })
})

describe('resolveTheme', () => {
  it('passes `dark` through regardless of system preference', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('passes `light` through regardless of system preference', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('follows the system preference when pref is `system`', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
