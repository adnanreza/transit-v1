import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ThemePref } from '@/lib/url-state'

interface ThemeToggleProps {
  pref: ThemePref
  onChange: (next: ThemePref) => void
}

const ICON: Record<ThemePref, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

// Linear cycle: system → light → dark → system. Matches the order users
// typically reach for (system is the well-behaved default; light/dark are the
// two explicit overrides).
const NEXT: Record<ThemePref, ThemePref> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const LABEL: Record<ThemePref, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

export function ThemeToggle({ pref, onChange }: ThemeToggleProps) {
  const Icon = ICON[pref]
  const nextPref = NEXT[pref]
  return (
    <Button
      variant="ghost"
      size="icon"
      className="pointer-events-auto bg-neutral-950/80 text-neutral-300 shadow-lg ring-1 ring-white/10 backdrop-blur hover:bg-neutral-900/80 hover:text-neutral-100"
      onClick={() => onChange(nextPref)}
      aria-label={LABEL[pref]}
      title={`${LABEL[pref]} (click for ${nextPref})`}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
