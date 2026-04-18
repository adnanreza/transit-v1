import type {
  DayType,
  TimeWindow,
} from '../../scripts/types/frequencies'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const DAY_OPTIONS: { value: DayType; label: string }[] = [
  { value: 'weekday', label: 'Weekday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: 'all_day', label: 'All day' },
  { value: 'am_peak', label: 'AM peak' },
  { value: 'midday', label: 'Midday' },
  { value: 'pm_peak', label: 'PM peak' },
  { value: 'evening', label: 'Evening' },
  { value: 'late_night', label: 'Late night' },
]

interface Props {
  day: DayType
  window: TimeWindow
  onDayChange: (day: DayType) => void
  onWindowChange: (window: TimeWindow) => void
}

export function FrequencyControls({
  day,
  window,
  onDayChange,
  onWindowChange,
}: Props) {
  return (
    <div className="pointer-events-auto flex flex-col gap-3 rounded-md bg-neutral-950/80 p-3 text-xs text-neutral-300 shadow-lg ring-1 ring-white/10 backdrop-blur">
      <section className="flex flex-col gap-1.5">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Day type
        </h2>
        <ToggleGroup
          type="single"
          value={day}
          onValueChange={(v) => {
            if (v) onDayChange(v as DayType)
          }}
          variant="outline"
          size="sm"
        >
          {DAY_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} aria-label={o.label}>
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Time window
        </h2>
        <ToggleGroup
          type="single"
          value={window}
          onValueChange={(v) => {
            if (v) onWindowChange(v as TimeWindow)
          }}
          variant="outline"
          size="sm"
        >
          {WINDOW_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} aria-label={o.label}>
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
    </div>
  )
}
