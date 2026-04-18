export type DayType = 'weekday' | 'saturday' | 'sunday'

export type TimeWindow =
  | 'all_day'
  | 'am_peak'
  | 'midday'
  | 'pm_peak'
  | 'evening'
  | 'late_night'

export type Band =
  | 'very_frequent'
  | 'frequent'
  | 'standard'
  | 'infrequent'
  | 'peak_only'
  | 'night_only'

export interface PatternFrequency {
  pattern_id: string
  shape_ids: string[]
  representative_stop_id: string
  first_stop_name: string
  last_stop_name: string
  trip_count: number
  trip_share: number
  headways: Record<DayType, Record<TimeWindow, number | null>>
  hourly: Record<DayType, Record<string, number | null>>
}

export interface RouteFrequency {
  route_id: string
  agency_name: string
  band: Band
  ftn_qualifies: boolean
  ftn_failure: { day_type: DayType; hour: number } | null
  patterns: PatternFrequency[]
}

export type FrequenciesFile = Record<string, RouteFrequency>
