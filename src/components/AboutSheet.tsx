import { useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface AboutSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutSheet({ open, onOpenChange }: AboutSheetProps) {
  // Mirrors the focus pattern from RouteDetailPanel (08): modal={false} skips
  // Radix's default autofocus so keyboard users otherwise have no entry point.
  const contentRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const el = contentRef.current
    if (el && !el.contains(document.activeElement)) {
      el.focus({ preventScroll: true })
    }
  }, [open])

  return (
    <Sheet open={open} modal={false} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        tabIndex={-1}
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
        aria-labelledby="about-sheet-title"
        aria-describedby="about-sheet-description"
      >
        <SheetHeader className="gap-2 border-b border-black/10 pb-4 dark:border-white/10">
          <SheetTitle id="about-sheet-title" className="text-base leading-tight">
            Metro Vancouver Frequent Transit Map
          </SheetTitle>
          <SheetDescription id="about-sheet-description" className="text-xs">
            How to read the map and why it exists.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4 text-sm text-neutral-800 dark:text-neutral-200">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              What you're looking at
            </h3>
            <p>
              This map colors every TransLink route by{' '}
              <strong>how often the bus actually comes</strong> at your chosen
              day and time — not a static system map, not a schedule lookup.
              Yellow routes come every 10 minutes or better: show up without
              checking a schedule. Dark blue routes you'll want to time.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              How to use it
            </h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Click a route for its frequency profile and FTN status.</li>
              <li>Toggle <em>Which day</em> and <em>Time of day</em> to see how the network shifts — try <em>Sunday / Late night</em>.</li>
              <li>Drag the sliders to redefine what counts as "frequent" and watch the map re-band live.</li>
              <li>Press <kbd className="rounded bg-neutral-200 px-1 text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">/</kbd> to search by route number (e.g. <em>99</em>, <em>R5</em>).</li>
            </ul>
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              What "FTN" means
            </h3>
            <p>
              TransLink's <strong>Frequent Transit Network</strong> is a route's
              promise to run at least every 15 minutes during the day — every
              hour from 6 AM to 9 PM, on weekdays, Saturdays, and Sundays. One
              failing hour on one day type disqualifies the route. It's a
              stricter bar than "frequent on average" and matches how riders
              actually experience frequent service.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              About the data
            </h3>
            <p>
              Transit data comes from TransLink's{' '}
              <a
                href="https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources"
                className="underline hover:text-neutral-950 dark:hover:text-neutral-100"
              >
                open GTFS feed
              </a>
              , refreshed weekly. Base map tiles from{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                className="underline hover:text-neutral-950 dark:hover:text-neutral-100"
              >
                OpenStreetMap
              </a>{' '}
              via Protomaps.
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Built as a portfolio project —{' '}
              <a
                href="https://github.com/adnanreza/transit-v1"
                className="underline hover:text-neutral-950 dark:hover:text-neutral-100"
              >
                source on GitHub
              </a>
              {' '}·{' '}
              <a
                href="https://github.com/adnanreza/transit-v1/blob/main/SPEC.md"
                className="underline hover:text-neutral-950 dark:hover:text-neutral-100"
              >
                product spec
              </a>
              .
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
