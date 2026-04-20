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

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          How often is "frequent"?
        </h2>
        <span className="text-[11px] text-neutral-500">drag to customize</span>
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
        aria-label="Frequency band thresholds"
      />
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Tick label="Very freq" value={thresholds.very_frequent} color={palette.very_frequent} />
        <Tick label="Frequent" value={thresholds.frequent} color={palette.frequent} />
        <Tick label="Standard" value={thresholds.standard} color={palette.standard} />
      </div>
    </section>
  )
}

function Tick({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-[3px] w-4 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <span className="ml-auto tabular-nums text-neutral-700 dark:text-neutral-300">≤{value}</span>
    </div>
  )
}
