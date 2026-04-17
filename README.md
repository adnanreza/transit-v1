# Metro Vancouver Frequent Transit Map

An interactive web map of TransLink's transit network, color-coded by service frequency. Distinguishes routes that qualify as part of the **Frequent Transit Network** (≤15 min headway, all day, every day) from peak-only and infrequent routes.

TransLink's own maps are static PDFs and don't treat frequency as a first-class concept. This project fills that gap.

→ See [`SPEC.md`](SPEC.md) for the full product spec: FTN definition, frequency bands, trip-pattern methodology, data pipeline, and deployment.

## Stack

Vite + React + TypeScript + Tailwind v4 + shadcn/ui. MapLibre GL + Protomaps PMTiles for the base map. All data is processed at build time from TransLink's GTFS feed — no backend, no tile server.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm test           # vitest
npm run typecheck
npm run lint
```

Node 20 (pinned in `.nvmrc`).

## Attribution

Transit data © [TransLink](https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources) (TransLink Open Data License).
Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under ODbL.

## License

MIT — see [`LICENSE`](LICENSE).

## Notes

Built with [Claude Code](https://claude.com/claude-code). Feature workflow lives in [`.claude/skills/feature/`](.claude/skills/feature/).
