import { describe, expect, it } from 'vitest'
import { formatFtnFailure } from './ftn-format'

describe('formatFtnFailure', () => {
  it('returns the confirming fallback when there is no failure', () => {
    const text = formatFtnFailure(null)
    expect(text).toMatch(/every hour 06:00/)
    expect(text).toMatch(/all day types/)
  })

  it('names the day_type and hour for a weekday morning failure', () => {
    const text = formatFtnFailure({ day_type: 'weekday', hour: 6 })
    expect(text).toMatch(/Weekday/)
    expect(text).toMatch(/6 AM/)
    expect(text).toMatch(/15 min/)
  })

  it('uses Saturday / Sunday labels for those day types', () => {
    expect(formatFtnFailure({ day_type: 'saturday', hour: 9 })).toMatch(/Saturday/)
    expect(formatFtnFailure({ day_type: 'sunday', hour: 21 })).toMatch(/Sunday/)
  })

  it('formats noon and PM hours naturally', () => {
    expect(formatFtnFailure({ day_type: 'weekday', hour: 12 })).toMatch(/12 PM/)
    expect(formatFtnFailure({ day_type: 'weekday', hour: 15 })).toMatch(/3 PM/)
    expect(formatFtnFailure({ day_type: 'weekday', hour: 21 })).toMatch(/9 PM/)
  })

  it('formats midnight as 12 AM', () => {
    expect(formatFtnFailure({ day_type: 'weekday', hour: 0 })).toMatch(/12 AM/)
  })
})
