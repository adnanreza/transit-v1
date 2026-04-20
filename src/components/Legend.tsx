import { bandColors, NO_SERVICE_COLOR } from '@/lib/band-palette'
import {
  DEFAULT_THRESHOLDS,
  type BandThresholds,
} from '@/lib/route-band'

interface Props {
  thresholds: BandThresholds
  theme: 'dark' | 'light'
}

// TransLink's rapid transit lines keep their GTFS-assigned brand colors in
// the map output, so they need their own key row — otherwise users reading
// the bus-frequency bands might think "yellow line" means "very frequent"
// when it's actually the Millennium Line. The colors here mirror what's
// shipped in routes.geojson.
const RAPID_TRANSIT_KEYS: { name: string; color: string }[] = [
  { name: 'Expo Line', color: '#0033a0' },
  { name: 'Millennium Line', color: '#ffcd00' },
  { name: 'Canada Line', color: '#007c9f' },
  { name: 'SeaBus', color: '#746661' },
  { name: 'West Coast Express', color: '#87189d' },
]

/**
 * Two-tier legend: the bus-frequency ramp on top, rapid transit brand colors
 * below. The split is important — the app encodes two different axes on the
 * map (how often does it run? vs what mode is it?) and users need both keys
 * visible to parse the colors they're seeing.
 */
export function Legend({ thresholds, theme }: Props) {
  const frequentMatchesFtn =
    thresholds.frequent === DEFAULT_THRESHOLDS.frequent
  const palette = bandColors(theme)

  return (
    <section
      aria-label="Frequency and mode legend"
      className="flex flex-col gap-2 text-[11px] text-neutral-700 dark:text-neutral-300"
    >
      {/* Bus frequency key */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          Bus frequency
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <KeyRow
            label={`≤${thresholds.very_frequent} min`}
            color={palette.very_frequent}
          />
          <KeyRow
            label={`≤${thresholds.frequent} min${frequentMatchesFtn ? ' (FTN)' : ''}`}
            color={palette.frequent}
          />
          <KeyRow
            label={`≤${thresholds.standard} min`}
            color={palette.standard}
          />
          <KeyRow
            label={`> ${thresholds.standard} min`}
            color={palette.infrequent}
          />
          <KeyRow label="Peak only" color={palette.peak_only} dashed />
          <KeyRow label="Night only" color={palette.night_only} dashed />
          <KeyRow label="No service" color={NO_SERVICE_COLOR} dimmed />
        </div>
      </div>

      {/* Rapid transit brand-color key */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          Rapid transit <span className="font-normal text-neutral-500">(line colors)</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {RAPID_TRANSIT_KEYS.map((line) => (
            <KeyRow key={line.name} label={line.name} color={line.color} />
          ))}
        </div>
      </div>
    </section>
  )
}

function KeyRow({
  label,
  color,
  dashed,
  dimmed,
}: {
  label: string
  color: string
  dashed?: boolean
  dimmed?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      {dashed ? (
        <DashedSwatch color={color} />
      ) : (
        <span
          aria-hidden="true"
          className="inline-block h-[3px] w-5 rounded-full"
          style={{ backgroundColor: color, opacity: dimmed ? 0.5 : 1 }}
        />
      )}
      <span className="tabular-nums">{label}</span>
    </span>
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
