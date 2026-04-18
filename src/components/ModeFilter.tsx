import { MODE_LABELS, MODES, type Mode } from '@/lib/modes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface Props {
  enabled: ReadonlySet<Mode>
  onChange: (next: Set<Mode>) => void
}

export function ModeFilter({ enabled, onChange }: Props) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        Mode
      </h2>
      <ToggleGroup
        type="multiple"
        value={[...enabled]}
        onValueChange={(v) => onChange(new Set(v as Mode[]))}
        variant="outline"
        size="sm"
      >
        {MODES.map((mode) => (
          <ToggleGroupItem
            key={mode}
            value={mode}
            aria-label={MODE_LABELS[mode]}
          >
            {MODE_LABELS[mode]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}
