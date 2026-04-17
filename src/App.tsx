import { lazy, Suspense } from 'react'

// Code-split the map: maplibre-gl + pmtiles + protomaps-themes-base add up to
// ~300 KB gz on their own, which blows SPEC's 300 KB initial-JS budget. Load
// them only after the shell renders.
const Map = lazy(() =>
  import('@/components/Map').then((m) => ({ default: m.Map })),
)

export default function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Suspense fallback={<div className="h-full w-full" />}>
        <Map />
      </Suspense>
      <footer className="pointer-events-none absolute inset-x-0 top-0 p-3 text-xs">
        <div className="pointer-events-auto mx-auto flex max-w-4xl flex-col gap-1 rounded-md bg-neutral-950/80 px-3 py-2 text-neutral-300 shadow-lg ring-1 ring-white/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p>
              Route and arrival data used in this product or service is provided by permission of{' '}
              <a
                href="https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources"
                className="underline hover:text-neutral-100"
              >
                TransLink
              </a>
              .
            </p>
            <p className="text-neutral-500">
              TransLink assumes no responsibility for the accuracy or currency of the Data used in this product or service.
            </p>
          </div>
          <a
            href="https://github.com/adnanreza/transit-v1"
            className="underline hover:text-neutral-100"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
