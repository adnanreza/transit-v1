import { parse } from 'csv-parse/sync'
import type { DayType } from '../types/frequencies.ts'

export interface CalendarEntry {
  service_id: string
  start_date: string // YYYYMMDD
  end_date: string // YYYYMMDD
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
}

export interface CalendarDateEntry {
  service_id: string
  date: string // YYYYMMDD
  exception_type: 1 | 2 // 1 = service added, 2 = service removed
}

const DOW_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export function parseCalendar(csv: string): CalendarEntry[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[]
  return rows.map((r) => ({
    service_id: r.service_id,
    start_date: r.start_date,
    end_date: r.end_date,
    monday: r.monday === '1',
    tuesday: r.tuesday === '1',
    wednesday: r.wednesday === '1',
    thursday: r.thursday === '1',
    friday: r.friday === '1',
    saturday: r.saturday === '1',
    sunday: r.sunday === '1',
  }))
}

export function parseCalendarDates(csv: string): CalendarDateEntry[] {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[]
  return rows.map((r) => ({
    service_id: r.service_id,
    date: r.date,
    exception_type: r.exception_type === '2' ? 2 : 1,
  }))
}

// YYYYMMDD with no dashes — the GTFS date format.
export function dateToGtfs(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

// Which service_ids are active on `date`? Follows GTFS rules:
//  - Start from calendar.txt: active if date ∈ [start_date, end_date] AND the
//    day-of-week flag is set.
//  - Apply calendar_dates.txt exceptions: type 1 adds, type 2 removes.
export function resolveActiveServices(
  date: Date,
  calendar: CalendarEntry[],
  calendarDates: CalendarDateEntry[],
): Set<string> {
  const active = new Set<string>()
  const gtfsDate = dateToGtfs(date)
  const dowKey = DOW_KEYS[date.getDay()]
  for (const c of calendar) {
    if (gtfsDate < c.start_date || gtfsDate > c.end_date) continue
    if (c[dowKey]) active.add(c.service_id)
  }
  for (const cd of calendarDates) {
    if (cd.date !== gtfsDate) continue
    if (cd.exception_type === 1) active.add(cd.service_id)
    else active.delete(cd.service_id)
  }
  return active
}

// Pick a representative Tuesday, Saturday, and Sunday by scanning a 7–28-day
// lookahead window and choosing the date of each weekday with the **most**
// active services. Max-active heuristic automatically avoids statutory
// holidays (which reduce service) without needing a holiday calendar.
// Tuesday is the chosen weekday — least likely to fall on a stat holiday and
// consistently represents "normal weekday" service.
export function pickRepresentativeDates(
  today: Date,
  calendar: CalendarEntry[],
  calendarDates: CalendarDateEntry[],
): { weekday: Date; saturday: Date; sunday: Date } {
  const tuesdays: Array<{ date: Date; count: number }> = []
  const saturdays: Array<{ date: Date; count: number }> = []
  const sundays: Array<{ date: Date; count: number }> = []

  for (let offset = 7; offset <= 28; offset++) {
    const d = addDays(today, offset)
    const active = resolveActiveServices(d, calendar, calendarDates)
    const entry = { date: d, count: active.size }
    switch (d.getDay()) {
      case 2:
        tuesdays.push(entry)
        break
      case 6:
        saturdays.push(entry)
        break
      case 0:
        sundays.push(entry)
        break
    }
  }

  const pickBest = (arr: typeof tuesdays): Date => {
    if (arr.length === 0) {
      throw new Error('No candidate dates found in lookahead window')
    }
    return arr.reduce((a, b) => (a.count >= b.count ? a : b)).date
  }

  return {
    weekday: pickBest(tuesdays),
    saturday: pickBest(saturdays),
    sunday: pickBest(sundays),
  }
}

// For each day type, the set of service_ids that run on that day type's
// representative date. A trip's day types = {day_type | trip.service_id ∈
// dayTypeServiceIds[day_type]}.
export function dayTypeServiceIds(
  representativeDates: { weekday: Date; saturday: Date; sunday: Date },
  calendar: CalendarEntry[],
  calendarDates: CalendarDateEntry[],
): Record<DayType, Set<string>> {
  return {
    weekday: resolveActiveServices(representativeDates.weekday, calendar, calendarDates),
    saturday: resolveActiveServices(representativeDates.saturday, calendar, calendarDates),
    sunday: resolveActiveServices(representativeDates.sunday, calendar, calendarDates),
  }
}
