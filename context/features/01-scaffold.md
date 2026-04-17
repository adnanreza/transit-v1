# 01 — Scaffold

Stand up the Vite + React + TypeScript shell and the dev-loop scripts the feature workflow depends on. No map, no data, no product surface area. The goal is a boring, correct baseline so that `02-data-pipeline` and `03-map-skeleton` can start without any Yak-shaving.

## Acceptance Criteria

- `npm run dev` launches Vite and serves a placeholder page at `http://localhost:5173`.
- `npm run build` produces `dist/` with no errors and initial JS **< 100 KB gzipped** (well under the SPEC's 300 KB budget — leaves headroom for the real app).
- `npm run typecheck` runs `tsc --noEmit` cleanly.
- `npm run lint` runs ESLint cleanly on `src/`.
- `npm test` runs Vitest and passes one placeholder unit test.
- Tailwind is configured; the placeholder page demonstrates a utility class is applied.
- **shadcn/ui** is initialized (`components.json`, path aliases, `src/lib/utils.ts`), with **no components installed**. Per SPEC, components go in as features need them.
- Placeholder page renders: project title, one-line description, attribution footer ("Transit data © TransLink" + "Map data © OpenStreetMap contributors"). Even the scaffold gets the footer — if it ships to Pages, attribution is correct from day one.
- A minimal `README.md` at repo root: what the project is, one-line pointer to `SPEC.md`, run/build/test commands, and the "Built with Claude Code; workflow in `.claude/skills/`" note.
- `.nvmrc` pins Node 20 (per SPEC, Cloudflare Pages uses this).

## Performance Budget

- Initial JS: **< 100 KB gzipped** (scaffold headroom check).
- No data files yet — `public/data/` does not exist.

## Out of Scope

- MapLibre / any map rendering
- Any GTFS or data-pipeline code
- shadcn components (install them in the features that need them)
- Routing (single page for now)
- Cloudflare Pages deploy wiring (that's a later feature)

## Depends On

Nothing. This is the root of the feature graph.

## Notes

- Use Vite's official `react-ts` template as the starting point; don't hand-roll.
- Path alias: `@/*` → `./src/*` (shadcn expects this).
- Keep config files at the repo root, source in `src/`.
- Commit granularity: at minimum split into `chore: scaffold vite + react + ts`, `chore: add tailwind`, `chore: initialize shadcn/ui`, `chore: add vitest + placeholder test`, `docs: add README`. Each commit should build cleanly on its own.
