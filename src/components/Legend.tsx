import { bandColors, NO_SERVICE_COLOR } from '@/lib/band-palette'
import {
  DEFAULT_THRESHOLDS,
  type BandThresholds,
} from '@/lib/route-band'

interface Props {
  thresholds: BandThresholds
  theme: 'dark' | 'light'
}

/**
 * Compact inline legend: a single row with band-colored swatches + threshold
 * values. Fits inside the bottom control strip at any viewport width and
 * replaces the old 7-row card. Dashed peak/night live as two small inline
 * chips; the "no service" state + "SkyTrain uses line colors" note live in
 * the About sheet, not here.
 */
export function Legend({ thresholds, theme }: Props) {
  const frequentMatchesFtn =
    thresholds.frequent === DEFAULT_THRESHOLDS.frequent
  const palette = bandColors(theme)

  const bandStops = [
    { value: thresholds.very_frequent, color: palette.very_frequent },
    { value: thresholds.frequent, color: palette.frequent, ftn: frequentMatchesFtn },
    { value: thresholds.standard, color: palette.standard },
  ]

  return (
    <section
      aria-label="Frequency legend"
      className="flex flex-col gap-1.5 text-[11px] text-neutral-700 dark:text-neutral-300"
    >
      <h2 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
        Frequency key
      </h2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Headway band swatches + "≤ N min" labels */}
        {bandStops.map((stop, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-[3px] w-5 rounded-full"
              style={{ backgroundColor: stop.color }}
            />
            <span className="tabular-nums">
              ≤{stop.value} min{stop.ftn ? ' (FTN)' : ''}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-[3px] w-5 rounded-full"
            style={{ backgroundColor: palette.infrequent }}
          />
          <span className="tabular-nums">&gt; {thresholds.standard} min</span>
        </span>

        {/* Dashed: peak + night */}
        <span className="flex items-center gap-1.5">
          <DashedSwatch color={palette.peak_only} />
          <span>Peak only</span>
        </span>
        <span className="flex items-center gap-1.5">
          <DashedSwatch color={palette.night_only} />
          <span>Night only</span>
        </span>

        {/* No service */}
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-[3px] w-5 rounded-full opacity-50"
            style={{ backgroundColor: NO_SERVICE_COLOR }}
          />
          <span>No service</span>
        </span>
      </div>
    </section>
  )
}

function DashedSwatch({ color }: { color: string }) {
  return (
    <svg
      width={20}
      height={3}
      viewBox="0 0 20 3"
      aria-hidden="true"
      className="shrink-0"
    >
      <line
        x1={0}
        y1={1.5}
        x2={20}
        y2={1.5}
        stroke={color}
        strokeWidth={3}
        strokeDasharray="4 2"
        strokeLinecap="round"
      />
    </svg>
  )
}
