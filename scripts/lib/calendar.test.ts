import { describe, it, expect } from 'vitest'
import {
  resolveActiveServices,
  type CalendarEntry,
  type CalendarDateEntry,
} from './calendar.ts'

const baseCalendar: CalendarEntry = {
  service_id: 'weekday',
  start_date: '20260420',
  end_date: '20260607',
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
}

describe('resolveActiveServices', () => {
  it('activates a service on a day-of-week it serves within the date range', () => {
    const tuesday = new Date('2026-04-28T12:00:00') // Tuesday
    const active = resolveActiveServices(tuesday, [baseCalendar], [])
    expect(active.has('weekday')).toBe(true)
  })

  it("does not activate on a day-of-week it doesn't serve", () => {
    const saturday = new Date('2026-04-25T12:00:00')
    const active = resolveActiveServices(saturday, [baseCalendar], [])
    expect(active.has('weekday')).toBe(false)
  })

  it('does not activate outside the start/end date range', () => {
    const beforeRange = new Date('2026-04-01T12:00:00') // Tuesday but before start
    const active = resolveActiveServices(beforeRange, [baseCalendar], [])
    expect(active.has('weekday')).toBe(false)
  })

  it('calendar_dates exception_type 1 adds service on a date that would not be active by calendar alone', () => {
    const saturday = new Date('2026-05-02T12:00:00') // Saturday, outside weekday pattern
    const addition: CalendarDateEntry = {
      service_id: 'weekday',
      date: '20260502',
      exception_type: 1,
    }
    const active = resolveActiveServices(saturday, [baseCalendar], [addition])
    expect(active.has('weekday')).toBe(true)
  })

  it('calendar_dates exception_type 2 removes a service that would be active by calendar', () => {
    const tuesday = new Date('2026-04-28T12:00:00')
    const removal: CalendarDateEntry = {
      service_id: 'weekday',
      date: '20260428',
      exception_type: 2,
    }
    const active = resolveActiveServices(tuesday, [baseCalendar], [removal])
    expect(active.has('weekday')).toBe(false)
  })
})
