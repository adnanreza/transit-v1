import { bandColors, NO_SERVICE_COLOR } from '@/lib/band-palette'
import {
  DEFAULT_THRESHOLDS,
  type BandThresholds,
} from '@/lib/route-band'

interface Props {
  thresholds: BandThresholds
  theme: 'dark' | 'light'
}

interface Row {
  label: string
  color: string
  dashed?: boolean
  dimmed?: boolean
}

export function Legend({ thresholds, theme }: Props) {
  const frequentMatchesFtn =
    thresholds.frequent === DEFAULT_THRESHOLDS.frequent
  const palette = bandColors(theme)

  const rows: Row[] = [
    {
      label: `Very frequent — every ${thresholds.very_frequent} min or better`,
      color: palette.very_frequent,
    },
    {
      label: frequentMatchesFtn
        ? `Frequent — every ${thresholds.frequent} min (FTN)`
        : `Frequent — every ${thresholds.frequent} min`,
      color: palette.frequent,
    },
    {
      label: `Standard — every ${thresholds.standard} min or better`,
      color: palette.standard,
    },
    {
      label: `Infrequent — every ${thresholds.standard}+ min`,
      color: palette.infrequent,
    },
    { label: 'Peak only (rush hour)', color: palette.peak_only, dashed: true },
    { label: 'Night only (overnight)', color: palette.night_only, dashed: true },
    { label: 'No service at this time', color: NO_SERVICE_COLOR, dimmed: true },
  ]

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-md bg-white/80 p-3 text-xs text-neutral-700 shadow-lg ring-1 ring-black/10 backdrop-blur dark:bg-neutral-950/80 dark:text-neutral-300 dark:ring-white/10">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        Frequency
      </h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <Swatch color={row.color} dashed={row.dashed} dimmed={row.dimmed} />
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
      {!frequentMatchesFtn && (
        <p className="mt-1 max-w-[14rem] text-[11px] text-neutral-500">
          FTN qualification stays at ≤15 min regardless of the slider.
        </p>
      )}
      <p className="mt-1 max-w-[14rem] text-[11px] text-neutral-500">
        SkyTrain, SeaBus, and West Coast Express use their line colors.
      </p>
    </div>
  )
}

function Swatch({
  color,
  dashed,
  dimmed,
}: {
  color: string
  dashed?: boolean
  dimmed?: boolean
}) {
  if (dashed) {
    return (
      <svg
        width={28}
        height={3}
        viewBox="0 0 28 3"
        aria-hidden="true"
        className="shrink-0"
      >
        <line
          x1={0}
          y1={1.5}
          x2={28}
          y2={1.5}
          stroke={color}
          strokeWidth={3}
          strokeDasharray="5 3"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[3px] w-7 shrink-0 rounded-full"
      style={{ backgroundColor: color, opacity: dimmed ? 0.5 : 1 }}
    />
  )
}
