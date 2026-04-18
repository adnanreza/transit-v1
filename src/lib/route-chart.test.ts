import { describe, expect, it } from 'vitest'
import type {
  PatternFrequency,
  RouteFrequency,
} from '../../scripts/types/frequencies'
import {
  CHART_HOURS,
  hourlyChartSeries,
  maxSeriesHeadway,
} from './route-chart'

function emptyHeadways() {
  const day = {
    all_day: null,
    am_peak: null,
    midday: null,
    pm_peak: null,
    evening: null,
    late_night: null,
  }
  return { weekday: day, saturday: day, sunday: day }
}

function pattern(
  id: string,
  trip_share: number,
  weekdayHourly: Record<number, number | null>,
): PatternFrequency {
  const hourlyWeekday: Record<string, number | null> = {}
  for (const [h, v] of Object.entries(weekdayHourly)) {
    hourlyWeekday[h] = v
  }
  return {
    pattern_id: id,
    shape_ids: [],
    representative_stop_id: 's',
    first_stop_name: '',
    last_stop_name: '',
    trip_count: 1,
    trip_share,
    headways: emptyHeadways(),
    hourly: {
      weekday: hourlyWeekday,
      saturday: {},
      sunday: {},
    },
  }
}

function route(patterns: PatternFrequency[]): RouteFrequency {
  return {
    route_id: 'r',
    agency_name: 'TransLink',
    band: 'frequent',
    ftn_qualifies: false,
    ftn_failure: null,
    patterns,
  }
}

describe('hourlyChartSeries', () => {
  it('returns one entry per chart hour (06–21)', () => {
    const series = hourlyChartSeries(route([]), 'weekday')
    expect(series.map((p) => p.hour)).toEqual(CHART_HOURS)
    expect(CHART_HOURS[0]).toBe(6)
    expect(CHART_HOURS.at(-1)).toBe(21)
    expect(CHART_HOURS).toHaveLength(16)
  })

  it('picks the worst (largest) headway across major patterns per hour', () => {
    const r = route([
      pattern('a', 0.6, { 8: 10, 9: 12 }),
      pattern('b', 0.4, { 8: 20, 9: 8 }),
    ])
    const series = hourlyChartSeries(r, 'weekday')
    const byHour = new Map(series.map((p) => [p.hour, p.headway]))
    expect(byHour.get(8)).toBe(20)
    expect(byHour.get(9)).toBe(12)
  })

  it('ignores minor patterns (trip_share < 0.2) even when their headway is worse', () => {
    const r = route([
      pattern('major', 0.8, { 10: 10 }),
      pattern('minor', 0.1, { 10: 60 }),
    ])
    const series = hourlyChartSeries(r, 'weekday')
    expect(series.find((p) => p.hour === 10)?.headway).toBe(10)
  })

  it('returns null for hours no major pattern has scheduled service', () => {
    const r = route([pattern('major', 1, { 10: 8 })])
    const series = hourlyChartSeries(r, 'weekday')
    expect(series.find((p) => p.hour === 6)?.headway).toBeNull()
    expect(series.find((p) => p.hour === 10)?.headway).toBe(8)
  })

  it('returns null for every hour when the route has no major patterns', () => {
    const r = route([pattern('minor', 0.1, { 10: 5 })])
    const series = hourlyChartSeries(r, 'weekday')
    expect(series.every((p) => p.headway === null)).toBe(true)
  })

  it('honors the requested day_type when patterns have per-day data', () => {
    const r: RouteFrequency = {
      route_id: 'r',
      agency_name: 'TransLink',
      band: 'standard',
      ftn_qualifies: false,
      ftn_failure: null,
      patterns: [
        {
          pattern_id: 'x',
          shape_ids: [],
          representative_stop_id: 's',
          first_stop_name: '',
          last_stop_name: '',
          trip_count: 1,
          trip_share: 1,
          headways: emptyHeadways(),
          hourly: {
            weekday: { '10': 8 },
            saturday: { '10': 20 },
            sunday: { '10': 30 },
          },
        },
      ],
    }
    expect(
      hourlyChartSeries(r, 'weekday').find((p) => p.hour === 10)?.headway,
    ).toBe(8)
    expect(
      hourlyChartSeries(r, 'saturday').find((p) => p.hour === 10)?.headway,
    ).toBe(20)
    expect(
      hourlyChartSeries(r, 'sunday').find((p) => p.hour === 10)?.headway,
    ).toBe(30)
  })
})

describe('maxSeriesHeadway', () => {
  it('returns the largest non-null value across multiple series', () => {
    expect(
      maxSeriesHeadway([
        [
          { hour: 6, headway: 5 },
          { hour: 7, headway: 12 },
        ],
        [
          { hour: 6, headway: 20 },
          { hour: 7, headway: null },
        ],
      ]),
    ).toBe(30) // floor is 30, value 20 is below it
  })

  it('respects the value when it exceeds the floor', () => {
    expect(
      maxSeriesHeadway([[{ hour: 6, headway: 45 }]], 30),
    ).toBe(45)
  })

  it('returns the explicit floor for an all-null series', () => {
    expect(
      maxSeriesHeadway(
        [
          [
            { hour: 6, headway: null },
            { hour: 7, headway: null },
          ],
        ],
        30,
      ),
    ).toBe(30)
  })
})
