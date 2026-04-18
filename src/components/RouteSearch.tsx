import { useEffect, useMemo, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { matchRouteQuery } from '@/lib/route-search'
import type { RouteIndexEntry } from '@/lib/use-routes'

interface Props {
  routes: RouteIndexEntry[] | null
  onSelect: (route: RouteIndexEntry) => void
}

export function RouteSearch({ routes, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // "/" to focus search, "esc" to close (cmdk handles esc for us).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      setOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const matches = useMemo(() => {
    if (!routes) return []
    return routes.filter((r) => matchRouteQuery(query, r)).slice(0, 50)
  }, [routes, query])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-xs text-neutral-700 shadow-lg ring-1 ring-black/10 backdrop-blur hover:text-neutral-950 dark:bg-neutral-950/80 dark:text-neutral-300 dark:ring-white/10 dark:hover:text-neutral-100"
      >
        <SearchIcon aria-hidden="true" className="size-3.5" />
        <span>Search routes</span>
        <kbd className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          /
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
        title="Search routes"
        description="Type a route number or name"
      >
        {/*
          shadcn's CommandDialog doesn't wrap its children in a Command
          provider, so the cmdk subscription store is missing without this.
        */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search routes — 99, R5, b-line..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {matches.length === 0 ? (
              <CommandEmpty>No matching routes.</CommandEmpty>
            ) : (
              <CommandGroup heading="Routes">
                {matches.map((route) => (
                  <CommandItem
                    key={route.route_id}
                    value={route.route_id}
                    onSelect={() => {
                      onSelect(route)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <span className="font-medium tabular-nums">
                      {route.route_short_name}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {route.route_long_name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
