import { Map } from '@/components/Map'

export default function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Map />
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
