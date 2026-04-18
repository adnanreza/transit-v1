import type { DayType } from '../../scripts/types/frequencies'

export interface FtnFailure {
  day_type: DayType
  hour: number
}

const DAY_LABEL: Record<DayType, string> = {
  weekday: 'Weekday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

/**
 * User-facing one-liner explaining why (or that) a route qualifies for the
 * FTN. When `failure` is null, returns the confirming fallback; otherwise
 * names the first failing (day_type, hour) in plain English. An optional
 * `headway` — the worst-major-pattern headway at that hour — gets folded in
 * as "headway is N min" when available, which is the shape SPEC cites.
 */
export function formatFtnFailure(
  failure: FtnFailure | null,
  headway?: number | null,
): string {
  if (!failure) {
    return 'Service runs at ≤15 min every hour 06:00–21:00 across all day types.'
  }
  const day = DAY_LABEL[failure.day_type]
  const hour = formatHour(failure.hour)
  if (headway != null) {
    return `${day} ${hour} headway is ${headway} min; FTN requires ≤15 min every hour 06:00–21:00 across all day types.`
  }
  return `${day} at ${hour} drops below the ≤15 min FTN threshold.`
}
