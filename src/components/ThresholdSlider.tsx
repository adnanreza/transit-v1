import { Slider } from '@/components/ui/slider'
import { bandColors } from '@/lib/band-palette'
import type { BandThresholds } from '@/lib/route-band'

interface Props {
  thresholds: BandThresholds
  theme: 'dark' | 'light'
  onChange: (next: BandThresholds) => void
}

const MIN = 1
const MAX = 60

export function ThresholdSlider({ thresholds, theme, onChange }: Props) {
  const values = [thresholds.very_frequent, thresholds.frequent, thresholds.standard]
  const palette = bandColors(theme)

  // Positioned value chips above the slider so each thumb has a directly-
  // attached label, not a disconnected tick row underneath. Horizontal % is
  // the same formula Radix uses internally for thumb position, so the chips
  // track the thumbs exactly as the user drags.
  const chips = [
    { value: thresholds.very_frequent, color: palette.very_frequent, label: 'Very frequent' },
    { value: thresholds.frequent, color: palette.frequent, label: 'Frequent' },
    { value: thresholds.standard, color: palette.standard, label: 'Standard' },
  ]

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          How often is "frequent"?
        </h2>
        <span className="text-[11px] text-neutral-500">drag to customize</span>
      </div>
      <div className="relative px-1 pt-5 pb-5">
        {/* Value chips directly above each thumb position */}
        <div
          className="pointer-events-none absolute inset-x-1 top-0 h-4"
          aria-hidden="true"
        >
          {chips.map((chip) => {
            const pct = ((chip.value - MIN) / (MAX - MIN)) * 100
            return (
              <span
                key={chip.label}
                className="absolute top-0 inline-flex -translate-x-1/2 items-center rounded px-1 py-0.5 font-mono text-[10px] font-semibold text-neutral-950 shadow-sm"
                style={{ left: `${pct}%`, backgroundColor: chip.color }}
              >
                {chip.value}
              </span>
            )
          })}
        </div>
        <Slider
          min={MIN}
          max={MAX}
          step={1}
          minStepsBetweenThumbs={1}
          value={values}
          onValueChange={([veryFrequent, frequent, standard]) =>
            onChange({
              very_frequent: veryFrequent,
              frequent,
              standard,
            })
          }
          aria-label="Frequency band thresholds (very frequent, frequent, standard — minutes)"
        />
        {/* Band names below — static position, not aligned to thumbs, since
            with 3 close values overlapping positioned labels would stack. */}
        <div className="absolute inset-x-1 bottom-0 flex items-center justify-between text-[10px] text-neutral-600 dark:text-neutral-400">
          {chips.map((chip) => (
            <span key={chip.label} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-[3px] w-3 rounded-full"
                style={{ backgroundColor: chip.color }}
              />
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
