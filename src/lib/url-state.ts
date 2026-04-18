import {
  parseAsStringLiteral,
  useQueryState,
  type Options,
} from 'nuqs'
import type { DayType, TimeWindow } from '../../scripts/types/frequencies'

export const DAY_TYPES = ['weekday', 'saturday', 'sunday'] as const satisfies DayType[]
export const TIME_WINDOWS = [
  'all_day',
  'am_peak',
  'midday',
  'pm_peak',
  'evening',
  'late_night',
] as const satisfies TimeWindow[]

// Shared options: default-omission so bare-root URLs stay clean, push-history
// for discrete toggles so back/forward step through user choices (slider /
// map-view hooks override to replace in their own modules).
const DISCRETE_OPTIONS = {
  clearOnDefault: true,
  history: 'push',
} as const satisfies Options

export const dayTypeParser = parseAsStringLiteral(DAY_TYPES)
  .withDefault('weekday')
  .withOptions(DISCRETE_OPTIONS)

export const timeWindowParser = parseAsStringLiteral(TIME_WINDOWS)
  .withDefault('all_day')
  .withOptions(DISCRETE_OPTIONS)

export function useDayType() {
  return useQueryState('d', dayTypeParser)
}

export function useTimeWindow() {
  return useQueryState('w', timeWindowParser)
}
