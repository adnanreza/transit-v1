import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AboutButtonProps {
  onClick: () => void
}

export function AboutButton({ onClick }: AboutButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="pointer-events-auto bg-white/80 text-neutral-700 shadow-lg ring-1 ring-black/10 backdrop-blur hover:bg-neutral-100/80 hover:text-neutral-950 dark:bg-neutral-950/80 dark:text-neutral-300 dark:ring-white/10 dark:hover:bg-neutral-900/80 dark:hover:text-neutral-100"
      onClick={onClick}
      aria-label="About this map"
      title="About this map"
    >
      <Info aria-hidden="true" />
    </Button>
  )
}
