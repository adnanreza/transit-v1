export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Metro Vancouver Frequent Transit Map
        </h1>
        <p className="mt-4 max-w-xl text-neutral-400">
          An interactive map of TransLink's network, color-coded by service frequency.
        </p>
      </main>
      <footer className="border-t border-neutral-800 px-6 py-4 text-xs text-neutral-500">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <div>
            Transit data ©{' '}
            <a
              href="https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources"
              className="underline hover:text-neutral-300"
            >
              TransLink
            </a>
            {' · '}
            Map data ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              className="underline hover:text-neutral-300"
            >
              OpenStreetMap contributors
            </a>
          </div>
          <a
            href="https://github.com/adnanreza/transit-v1"
            className="underline hover:text-neutral-300"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
