interface RouteTooltipProps {
  x: number
  y: number
  shortName: string
  longName: string
  bandLabel: string
}

const MAX_LONG_NAME = 28

function truncate(name: string, max: number): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1).trimEnd() + '…'
}

/**
 * Small near-cursor tooltip shown while hovering a route. Positioned with
 * transform instead of left/top so the browser can composite it cheaply on
 * every mousemove; offset a little below-right of the cursor so the pointer
 * itself doesn't obscure the first character.
 */
export function RouteTooltip({
  x,
  y,
  shortName,
  longName,
  bandLabel,
}: RouteTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-50 max-w-xs rounded-md bg-white/90 px-2.5 py-1.5 text-xs text-neutral-900 shadow-lg ring-1 ring-black/10 backdrop-blur dark:bg-neutral-950/90 dark:text-neutral-100 dark:ring-white/10"
      style={{ transform: `translate(${x + 14}px, ${y + 14}px)` }}
      role="tooltip"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-semibold">{shortName}</span>
        <span className="text-neutral-700 dark:text-neutral-300">{truncate(longName, MAX_LONG_NAME)}</span>
      </div>
      <div className="text-[11px] text-neutral-600 dark:text-neutral-400">{bandLabel}</div>
    </div>
  )
}
