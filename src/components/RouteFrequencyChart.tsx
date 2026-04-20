import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  hourlyChartSeries,
  maxSeriesHeadway,
  type HourlyPoint,
} from '@/lib/route-chart'
import type {
  DayType,
  RouteFrequency,
} from '../../scripts/types/frequencies'

const FTN_THRESHOLD_MIN = 15
// Fixed y-axis floor. `maxSeriesHeadway`'s default is 30, which makes the
// 15-min FTN line sit at the middle (top half = "more frequent than FTN",
// bottom half = "below FTN"). Letting the auto-scale go lower collapses the
// data onto the top edge and the chart reads as empty.
const Y_AXIS_FLOOR = 45
const DAY_ORDER: { day: DayType; label: string }[] = [
  { day: 'weekday', label: 'Weekday' },
  { day: 'saturday', label: 'Saturday' },
  { day: 'sunday', label: 'Sunday' },
]

interface Props {
  route: RouteFrequency
}

// Recharts line chart passes the hour label through directly; formatting lives
// here so the axis reads like a clock (6 AM, noon, 9 PM) instead of raw ints.
function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12 AM'
  if (h === 12) return 'noon'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

function formatHeadway(value: number | null): string {
  if (value == null) return '—'
  return `${value} min`
}

export function RouteFrequencyChart({ route }: Props) {
  const series = DAY_ORDER.map(({ day, label }) => ({
    day,
    label,
    data: hourlyChartSeries(route, day),
  }))
  // Shared y-max so the three multiples are visually comparable. Floor at 45
  // min gives the 15-min FTN line a middle-of-the-chart anchor regardless of
  // how frequent the route actually is.
  const yMax = maxSeriesHeadway(series.map((s) => s.data), Y_AXIS_FLOOR)

  return (
    <section aria-labelledby="route-detail-chart" className="flex flex-col gap-3">
      <h3
        id="route-detail-chart"
        className="text-xs font-medium text-neutral-900 dark:text-neutral-100"
      >
        24-hour headway profile
      </h3>
      <div className="flex flex-col gap-3">
        {series.map(({ day, label, data }) => (
          <DayMultiple key={day} label={label} data={data} yMax={yMax} />
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">
        Headway in minutes at each hour of day. The dashed line is the 15-min
        FTN threshold — values above the line qualify that hour for FTN.
      </p>
    </section>
  )
}

interface DayMultipleProps {
  label: string
  data: HourlyPoint[]
  yMax: number
}

function DayMultiple({ label, data, yMax }: DayMultipleProps) {
  return (
    <figure className="rounded-md bg-neutral-200/40 p-2 ring-1 ring-black/5 dark:bg-neutral-950/40 dark:ring-white/5">
      <figcaption className="px-1 pb-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </figcaption>
      <div className="h-24 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ffffff10" vertical={false} />
            <XAxis
              dataKey="hour"
              type="number"
              domain={[6, 21]}
              ticks={[6, 9, 12, 15, 18, 21]}
              tickFormatter={formatHour}
              stroke="#737373"
              tick={{ fontSize: 10, fill: '#a3a3a3' }}
              interval="preserveStartEnd"
            />
            <YAxis
              // Inverted domain: headway 0 is visually at the top, yMax at the
              // bottom — so "more frequent" reads as higher on the plot.
              domain={[yMax, 0]}
              ticks={[0, 15, 30, yMax]}
              tickFormatter={(v: number) => `${v}`}
              stroke="#737373"
              tick={{ fontSize: 10, fill: '#a3a3a3' }}
              width={28}
            />
            <ReferenceLine
              y={FTN_THRESHOLD_MIN}
              stroke="#fbbf24"
              strokeDasharray="3 3"
              strokeWidth={1}
            >
              <Label
                value="15 min"
                position="insideRight"
                offset={2}
                fill="#fbbf24"
                fontSize={10}
                fontWeight={500}
              />
            </ReferenceLine>
            <Tooltip
              cursor={{ stroke: '#ffffff30' }}
              contentStyle={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #ffffff20',
                borderRadius: 6,
                fontSize: 11,
                padding: '4px 8px',
                color: '#fafafa',
              }}
              labelStyle={{ color: '#fafafa' }}
              itemStyle={{ color: '#fafafa' }}
              labelFormatter={(hour) =>
                typeof hour === 'number' ? formatHour(hour) : ''
              }
              formatter={(value) => [
                formatHeadway(value as number | null),
                'headway',
              ]}
            />
            <Line
              type="monotone"
              dataKey="headway"
              stroke="#fafafa"
              strokeWidth={1.5}
              dot={{ r: 1.5, fill: '#fafafa' }}
              activeDot={{ r: 3, fill: '#fafafa' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
