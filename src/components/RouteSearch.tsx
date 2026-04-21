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
import {
  displayShortName,
  groupRoutesForEmptyState,
  highlightMatch,
  rankedMatches,
} from '@/lib/route-search'
import type { RouteIndexEntry } from '@/lib/use-routes'
import type { FrequenciesFile } from '../../scripts/types/frequencies'

interface Props {
  routes: RouteIndexEntry[] | null
  frequencies: FrequenciesFile | null
  onSelect: (route: RouteIndexEntry) => void
}

// Soft cap for very large typed-result sets. cmdk renders each row cheaply,
// but a 237-row list on low-end phones has some first-paint cost — 200 is
// plenty of headroom for any real-world query.
const RESULT_LIMIT = 200

export function RouteSearch({ routes, frequencies, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Global shortcuts: "/" opens, "⌘K" / "Ctrl+K" opens too (standard command-
  // palette binding). Both ignore keydowns inside form controls so typing
  // into an input doesn't hijack the shortcut. Esc closing is handled by
  // cmdk itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const frequentIds = useMemo(() => {
    if (!frequencies) return null
    const ids = new Set<string>()
    for (const [id, r] of Object.entries(frequencies)) {
      if (r.band === 'frequent' || r.band === 'very_frequent') ids.add(id)
    }
    return ids
  }, [frequencies])

  const groups = useMemo(() => {
    if (!routes) return null
    const predicate = frequentIds
      ? (r: RouteIndexEntry) => frequentIds.has(r.route_id)
      : null
    return groupRoutesForEmptyState(routes, predicate)
  }, [routes, frequentIds])

  const typedMatches = useMemo(() => {
    if (!routes || query.trim().length === 0) return null
    return rankedMatches(query, routes).slice(0, RESULT_LIMIT)
  }, [routes, query])

  const queryIsBlank = query.trim().length === 0

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
          if (!next) {
            // Reset the input and the "Show all" expansion on close so the
            // next open starts from the curated groups again.
            setQuery('')
            setShowAll(false)
          }
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
            placeholder="Search — 99, R4, Main St, UBC"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {queryIsBlank ? (
              <EmptyStateGroups
                groups={groups}
                showAll={showAll}
                onShowAll={() => setShowAll(true)}
                onSelect={(route) => {
                  onSelect(route)
                  setOpen(false)
                  setQuery('')
                }}
              />
            ) : typedMatches && typedMatches.length === 0 ? (
              <CommandEmpty>No matching routes.</CommandEmpty>
            ) : (
              <CommandGroup heading="Results">
                {typedMatches?.map((route) => (
                  <RouteRow
                    key={route.route_id}
                    route={route}
                    query={query}
                    onSelect={() => {
                      onSelect(route)
                      setOpen(false)
                      setQuery('')
                    }}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

interface EmptyStateProps {
  groups: ReturnType<typeof groupRoutesForEmptyState<RouteIndexEntry>> | null
  showAll: boolean
  onShowAll: () => void
  onSelect: (route: RouteIndexEntry) => void
}

function EmptyStateGroups({
  groups,
  showAll,
  onShowAll,
  onSelect,
}: EmptyStateProps) {
  if (!groups) return <CommandEmpty>Loading routes…</CommandEmpty>
  const { rapidTransit, rapidBus, frequent, other } = groups
  const hasAnything =
    rapidTransit.length + rapidBus.length + frequent.length + other.length > 0
  if (!hasAnything) return <CommandEmpty>No routes available.</CommandEmpty>
  return (
    <>
      {rapidTransit.length > 0 && (
        <Group heading="Rapid transit">
          {rapidTransit.map((route) => (
            <RouteRow
              key={route.route_id}
              route={route}
              query=""
              onSelect={() => onSelect(route)}
            />
          ))}
        </Group>
      )}
      {rapidBus.length > 0 && (
        <Group heading="RapidBus">
          {rapidBus.map((route) => (
            <RouteRow
              key={route.route_id}
              route={route}
              query=""
              onSelect={() => onSelect(route)}
            />
          ))}
        </Group>
      )}
      {frequent.length > 0 && (
        <Group heading="Frequent buses">
          {frequent.map((route) => (
            <RouteRow
              key={route.route_id}
              route={route}
              query=""
              onSelect={() => onSelect(route)}
            />
          ))}
        </Group>
      )}
      {other.length > 0 &&
        (showAll ? (
          <Group heading="All other routes">
            {other.map((route) => (
              <RouteRow
                key={route.route_id}
                route={route}
                query=""
                onSelect={() => onSelect(route)}
              />
            ))}
          </Group>
        ) : (
          <CommandGroup>
            <CommandItem
              value="__show-all__"
              onSelect={onShowAll}
              className="justify-center text-xs text-neutral-600 dark:text-neutral-400"
            >
              Show all {other.length} other routes
            </CommandItem>
          </CommandGroup>
        ))}
    </>
  )
}

// Thin wrapper so the group heading matches the app-wide section-heading
// style introduced in feature 14. cmdk's default `CommandGroup` heading
// uses uppercase tracking — we override the class to match the rest of
// the app.
function Group({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <CommandGroup
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:text-neutral-900 [&_[cmdk-group-heading]]:normal-case dark:[&_[cmdk-group-heading]]:text-neutral-100"
    >
      {children}
    </CommandGroup>
  )
}

function RouteRow({
  route,
  query,
  onSelect,
}: {
  route: RouteIndexEntry
  query: string
  onSelect: () => void
}) {
  const short = displayShortName(route.route_short_name) || '—'
  return (
    <CommandItem value={route.route_id} onSelect={onSelect}>
      <span className="font-medium tabular-nums">
        <HighlightedText text={short} query={query} />
      </span>
      <span className="truncate text-muted-foreground">
        <HighlightedText text={route.route_long_name} query={query} />
      </span>
    </CommandItem>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const span = highlightMatch(text, query)
  if (!span) return <>{text}</>
  return (
    <>
      {span.before}
      <mark className="rounded-sm bg-amber-200/70 px-0.5 text-neutral-900 dark:bg-amber-400/30 dark:text-neutral-50">
        {span.match}
      </mark>
      {span.after}
    </>
  )
}
