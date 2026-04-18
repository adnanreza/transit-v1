import {
  parseAsArrayOf,
  parseAsStringLiteral,
  useQueryState,
  type Options,
} from 'nuqs'
import { useCallback, useMemo } from 'react'
import { MODES, type Mode } from './modes'
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

// Every mode enabled, in alphabetical order — matches the serialized form a
// user-saved "all on" state would round-trip to, so clearOnDefault can strip
// the param when the user lands back at the default.
const MODES_SORTED_ALL = [...MODES].sort() as Mode[]

const modeListParser = parseAsArrayOf(parseAsStringLiteral(MODES), ',')
  .withDefault(MODES_SORTED_ALL)
  .withOptions(DISCRETE_OPTIONS)

export function useModeFilter(): [
  ReadonlySet<Mode>,
  (next: Set<Mode>) => void,
] {
  const [arr, setArr] = useQueryState('m', modeListParser)

  const enabled = useMemo(() => new Set(arr), [arr])

  const setEnabled = useCallback(
    (next: Set<Mode>) => {
      // Sort on write so URLs round-trip to the same string regardless of
      // the order the user toggled chips.
      setArr([...next].sort() as Mode[])
    },
    [setArr],
  )

  return [enabled, setEnabled]
}
