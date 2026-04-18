import { BAND_COLORS, NO_SERVICE_COLOR } from '@/lib/band-palette'
import {
  DEFAULT_THRESHOLDS,
  type BandThresholds,
} from '@/lib/route-band'

interface Props {
  thresholds: BandThresholds
}

interface Row {
  label: string
  color: string
  dashed?: boolean
  dimmed?: boolean
}

export function Legend({ thresholds }: Props) {
  const frequentMatchesFtn =
    thresholds.frequent === DEFAULT_THRESHOLDS.frequent

  const rows: Row[] = [
    { label: `\u2264 ${thresholds.very_frequent} min`, color: BAND_COLORS.very_frequent },
    {
      label: frequentMatchesFtn
        ? `\u2264 ${thresholds.frequent} min (FTN)`
        : `\u2264 ${thresholds.frequent} min`,
      color: BAND_COLORS.frequent,
    },
    { label: `\u2264 ${thresholds.standard} min`, color: BAND_COLORS.standard },
    { label: `> ${thresholds.standard} min`, color: BAND_COLORS.infrequent },
    { label: 'Peak only', color: BAND_COLORS.peak_only, dashed: true },
    { label: 'Night only', color: BAND_COLORS.night_only, dashed: true },
    { label: 'No service', color: NO_SERVICE_COLOR, dimmed: true },
  ]

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-md bg-neutral-950/80 p-3 text-xs text-neutral-300 shadow-lg ring-1 ring-white/10 backdrop-blur">
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
